import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const userId = '10000000-0000-4000-8000-000000000010';
const api = 'https://moqpjxzkhdmruqxpjvpz.supabase.co';
const photoPath = `${userId}/10000000-0000-4000-8000-000000000020.jpg`;
const settings = { id: 1, title: 'Zomora’s Corner', tagline: 'Little joys.', about: 'A quiet corner.', email: '', instagram: '' };
type Row = Record<string, any>;

test('coffee hero loops silently, pauses, and respects reduced motion', async ({page}) => {
  await mockBackend(page);
  await page.goto('/');
  const video = page.locator('.hero-video video');
  await expect(page.getByText('A small step is still a step.', {exact:false})).toBeVisible();
  await expect(page.getByText('Psalm 46:10 · NLT')).toBeVisible();
  await page.locator('.coffee-moment').screenshot({path:'.test-artifacts/coffee-hero-desktop.png'});
  await expect(page.getByRole('button', {name:'Pause coffee video'})).toBeVisible();
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted && v.loop && v.playsInline)).toBeTruthy();
  await page.getByRole('button', {name:'Pause coffee video'}).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBeTruthy();
  await page.getByRole('button', {name:'Play coffee video'}).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBeFalsy();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.test-artifacts/coffee-hero-mobile.png',fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await expect(video).not.toHaveAttribute('src');
  await expect(page.locator('.hero-video-poster')).toBeVisible();
  await expect(page.getByRole('button', {name:'Play coffee video'})).toBeVisible();
});

async function mockBackend(page: Page, writer = false) {
  let rows: Row[] = [];
  const uploads: string[] = [];
  if (writer) {
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000)+3600, role:'authenticated' })).toString('base64url');
    await page.addInitScript(({ userId, payload }) => localStorage.setItem('sb-moqpjxzkhdmruqxpjvpz-auth-token', JSON.stringify({
      access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`, refresh_token:'mock-refresh', token_type:'bearer', expires_at:Math.floor(Date.now()/1000)+3600,
      user:{ id:userId, email:'writer@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{}, user_metadata:{}, created_at:new Date().toISOString() },
    })), { userId, payload });
  }
  await page.route(`${api}/**`, async route => {
    const req=route.request(); const url=new URL(req.url()); const method=req.method();
    const send=(body: unknown, status=200) => route.fulfill({status,json:body,headers:{'access-control-allow-origin':'*'}});
    if(method==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(url.pathname==='/functions/v1/daily-inspiration') {
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      return send({quote:{text:'A small step is still a step.',author:'Test author',day},verse:{text:'Test verse text for layout verification.',reference:'Psalm 46:10',version:'NLT',day}});
    }
    if(url.pathname.startsWith('/rest/v1/writers')) return send(writer ? [{email:'writer@example.invalid'}] : []);
    if(url.pathname.startsWith('/rest/v1/site_settings')) return send(settings);
    if(url.pathname.startsWith('/rest/v1/posts')) {
      if(method==='GET') return send(rows);
      if(method==='POST' || method==='PATCH') {
        const body=req.postDataJSON(); const old=rows.find(p=>p.id===body.id); const now=new Date().toISOString();
        if(method==='PATCH' && url.searchParams.get('updated_at') !== `eq.${old?.updated_at}`) return send(null);
        const saved={...body,created_at:old?.created_at||now,updated_at:now,published_at:body.status==='published' ? old?.published_at||now : old?.published_at||null};
        rows=[saved,...rows.filter(p=>p.id!==body.id)]; return send(saved,method==='POST'?201:200);
      }
      if(method==='DELETE') {const id=url.searchParams.get('id')?.slice(3);rows=rows.filter(p=>p.id!==id);return send([{id}]);}
    }
    if(url.pathname.includes('/storage/v1/object/sign/') && method==='POST') {
      return send(req.postDataJSON().paths.map((path:string)=>({path,signedURL:`/object/sign/story-photos/${path}?token=mock`,error:null})));
    }
    if(url.pathname.includes('/storage/v1/object/') && method==='POST') {
      const path=url.pathname.split('/story-photos/')[1];uploads.push(path);return send({Key:`story-photos/${path}`,Id:'image-id'});
    }
    if(url.pathname.includes('/storage/v1/object/') && method==='GET') return route.fulfill({status:200,contentType:'image/png',body:await readFile('public/favicon.png')});
    if(url.pathname.includes('/auth/v1/logout')) return send({});
    if(url.pathname.includes('/auth/v1/user')) return send({id:userId,email:'writer@example.invalid'});
    return send({message:'Not mocked: '+url.pathname},400);
  });
  return { rows:()=>rows, uploads, setRows:(next:Row[])=>{rows=next;} };
}

test('daily readings label stale content and handle unavailable providers', async ({page}) => {
  await mockBackend(page);
  await page.route(`${api}/functions/v1/daily-inspiration`, route => route.fulfill({json:{
    quote:{text:'A saved encouragement.',author:'Test author',day:'2025-01-01'},verse:null,
  }}));
  await page.goto('/');
  await expect(page.getByText('Saved reading · 2025-01-01')).toBeVisible();
  await expect(page.getByText('Today’s NLT verse is taking a little longer.',{exact:false})).toBeVisible();
  await page.route(`${api}/functions/v1/daily-inspiration`, route => route.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.reload();
  await expect(page.getByText('Today’s quote will be back soon.',{exact:false})).toBeVisible();
});

test('reader pages, filtering, mobile layout and password visibility', async ({page})=>{
  const backend=await mockBackend(page);
  backend.setRows([{id:'one',slug:'little-joy',title:'Little joy',summary:'A warm cup',body:'Hello world',category:'Little joys',status:'published',photos:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString(),published_at:new Date().toISOString()}]);
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Little joy',exact:true})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Stories'}).click();
  await page.getByRole('searchbox').fill('unmatched'); await expect(page.getByRole('heading',{name:'Nothing on this page just yet.'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByRole('heading',{name:'Little joy',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/writer');await page.getByRole('button',{name:'First visit? Set up your account'}).click();
  const password=page.getByLabel('Password',{exact:true});const confirm=page.getByLabel('Confirm password',{exact:true});
  await password.fill('just-a-browser-test');await confirm.fill('just-a-browser-test');
  await page.getByRole('button',{name:'Show password'}).click();await confirm.focus();
  await expect(password).toHaveAttribute('type','text');await expect(confirm).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Show password'}).click();await expect(password).toHaveAttribute('type','password');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('writer saves photos privately, previews, publishes, downloads, restores and deletes', async ({page})=>{
  const backend=await mockBackend(page,true);
  await page.goto('/writer');await page.getByRole('button',{name:'Write a story'}).click();
  await page.getByLabel('Title',{exact:true}).fill('Morning light');
  await page.getByLabel('A short introduction').fill('A small moment worth keeping.');
  await page.getByLabel('Your story',{exact:false}).fill('First paragraph.\n\nA second little thought.');
  await page.getByLabel('Upload story photos').setInputFiles('public/favicon.png');
  await expect(page.getByLabel('Photo description')).toBeVisible();
  await page.getByLabel('Photo description').fill('A colorful coffee cup');await page.getByLabel('Caption').fill('Coffee first.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Draft saved online');
  expect(backend.rows()[0].status).toBe('draft');expect(backend.uploads).toHaveLength(1);
  await page.getByRole('button',{name:'Preview',exact:false}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Morning light'})).toBeVisible();
  await page.getByRole('button',{name:'Publish story',exact:false}).click();await expect(page.getByRole('status')).toContainText('visible to everyone');
  expect(backend.rows()[0].photos[0].caption).toBe('Coffee first.');
  await page.getByRole('button',{name:'Keep writing',exact:false}).click();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download a backup'}).click();
  const download=await downloadEvent;const path=await download.path();const json=JSON.parse(await readFile(path!,'utf8'));
  expect(json.Title).toBe('Morning light');expect(json.Photos[0].data).toMatch(/^data:image\//);
  await page.getByRole('button',{name:'Writing desk',exact:false}).click();
  await page.getByLabel('Load draft JSON file').setInputFiles({name:'restored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
  await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Morning light');
  await expect(page.getByLabel('Photo description')).toHaveValue('A colorful coffee cup');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('status')).toContainText('Draft saved online');
  expect(backend.rows()).toHaveLength(2);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.test-artifacts/editor-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Writing desk',exact:false}).click();
  await page.screenshot({path:'.test-artifacts/desk-mobile.png',fullPage:true});
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete Morning light',exact:true}).first().click();
  await expect(page.getByRole('status')).toHaveText('Story deleted.');expect(backend.rows()).toHaveLength(1);
});

test('invalid imports are rejected; failed writes preserve typed text',async({page})=>{
  await mockBackend(page,true);await page.goto('/writer');await expect(page.getByRole('heading',{name:'The writing desk.'})).toBeVisible();
  await page.getByLabel('Load draft JSON file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.getByRole('alert')).toContainText('valid JSON');
  await page.getByRole('button',{name:'Write a story'}).click();await page.getByLabel('Title',{exact:true}).fill('Keep my words');
  await page.route(`${api}/rest/v1/posts**`,route=>route.request().method()==='POST'?route.fulfill({status:500,json:{message:'Test write failure'}}):route.fallback());
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Test write failure');await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Keep my words');
});

