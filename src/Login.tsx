import { Icon } from './Icon';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from './supabase';
import { useBlog } from './blog';
import { messageOf } from './model';

export function Login({ changePassword = false, done }: { changePassword?: boolean; done?: () => void }) {
  const blog = useBlog();
  const [mode, setMode] = useState<'login' | 'activate'>('login');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const recovery = blog.recovery || changePassword;
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if ((mode === 'activate' || recovery) && password !== confirmation) throw new Error('The passwords need to match.');
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        blog.finishRecovery(); setNotice('Your password is updated.'); done?.();
      } else if (mode === 'activate') {
        const { data, error } = await supabase.functions.invoke('activate-writer', { body: { code, password } });
        if (error) {
          let detail = 'Could not activate. The code may have expired or already been used.';
          if ('context' in error && error.context instanceof Response) { try { detail = (await error.context.json()).error || detail; } catch { /* Use safe fallback. */ } }
          throw new Error(detail);
        }
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: data.email, password });
        if (loginError) { setEmail(data.email); setMode('login'); throw new Error('Account created. Please sign in with your email and new password.'); }
        setCode(''); await blog.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error;
        await blog.refresh();
      }
      setPassword(''); setConfirmation(''); setShow(false);
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <div className="login-layout"><div><p className="eyebrow">JUST FOR YOU, ZOMORA</p><h1>Your thoughts.<br/><em>Your own pace.</em></h1><p className="lead">A quiet little desk for your words and pictures. Save a thought, come back after coffee, publish when it feels right.</p><div className="login-note"><Icon name="flower"/> <span>Drafts are private.<br/>Published stories are for everyone.</span></div></div>
    <form className="editor login-card" onSubmit={submit}><p className="eyebrow">THE WRITING DESK</p><h2>{recovery ? 'A fresh password.' : mode === 'login' ? 'Welcome back.' : mode === 'activate' ? 'Make yourself at home.' : 'Let’s get you back in.'}</h2>
      {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      {!recovery && mode === 'login' && <label>Email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
      {!recovery && mode === 'activate' && <label>Private setup code<input autoComplete="off" required value={code} onChange={e => setCode(e.target.value)}/><small>Your one-time code opens your desk. No email needed.</small></label>}
      <label>Password<div className="password-field"><input type={show ? 'text' : 'password'} maxLength={128} required minLength={mode === 'activate' || recovery ? 8 : undefined} autoComplete={mode === 'activate' || recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="password-toggle" aria-label="Show password" aria-pressed={show} onClick={() => setShow(!show)}><Icon name={show ? 'hidden' : 'visible'}/></button></div></label>
      {(mode === 'activate' || recovery) && <label>Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>}
      <button className="button" disabled={busy}>{busy ? 'One moment…' : recovery ? 'Save new password' : mode === 'login' ? <>Open my writing desk <Icon name="outward"/></> : mode === 'activate' ? 'Create my writer account' : 'Send reset link'}</button>
      {!recovery && <div className="login-options">{(['login','activate'] as const).filter(m => m !== mode).map(m => <button type="button" className="quiet-button" key={m} onClick={() => { setMode(m); setError(''); setNotice(''); setShow(false); setPassword(''); setConfirmation(''); }}>{m === 'login' ? 'Back to sign in' : 'First visit? Set up your account'}</button>)}</div>}
      {done && <button type="button" className="quiet-button" onClick={done}>Back to the writing desk</button>}
      {!recovery && <details className="password-help"><summary>Forgot your password?</summary><p>Ask the site administrator to reset it. Email resets aren’t enabled for this little corner yet.</p></details>}
    </form></div>;
}
