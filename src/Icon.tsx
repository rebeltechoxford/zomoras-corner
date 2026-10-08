import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import LocalCafeOutlined from '@mui/icons-material/LocalCafeOutlined';
import SpaOutlined from '@mui/icons-material/SpaOutlined';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';
import UndoRounded from '@mui/icons-material/UndoRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import PauseRounded from '@mui/icons-material/PauseRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';

const icons = {
  add: AddRounded, back: ArrowBackRounded, outward: ArrowOutwardRounded,
  download: DownloadRounded, upload: UploadRounded, write: EditNoteRounded,
  heart: FavoriteBorderRounded, coffee: LocalCafeOutlined, flower: SpaOutlined,
  sun: WbSunnyOutlined, undo: UndoRounded, visible: VisibilityOutlined,
  hidden: VisibilityOffOutlined, pause: PauseRounded, play: PlayArrowRounded,
};

// Icons accompany visible text, or an explicitly labelled button.
export function Icon({ name }: { name: keyof typeof icons }) {
  const MaterialIcon = icons[name];
  return <MaterialIcon className="ui-icon" fontSize="inherit" aria-hidden="true" focusable="false"/>;
}
