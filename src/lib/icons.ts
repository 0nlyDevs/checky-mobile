import { createElement, type ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  ArrowLeft as PArrowLeft,
  Lightning as PLightning,
  QrCode as PQrCode,
  Camera as PCamera,
  Stamp as PStamp,
  Phone as PPhone,
  Globe as PGlobe,
  Envelope as PEnvelope,
  ChartBar as PChartBar,
  AddressBook as PAddressBook,
  ArrowSquareOut as PArrowSquareOut,
  Broadcast as PBroadcast,
  CheckCircle as PCheckCircle,
  CircleDashed as PCircleDashed,
  CaretRight as PCaretRight,
  ChatTeardropText as PChatTeardropText,
  Check as PCheck,
  CheckSquare as PCheckSquare,
  Checks as PChecks,
  ClipboardText as PClipboardText,
  Clock as PClock,
  CloudArrowUp as PCloudArrowUp,
  CloudSlash as PCloudSlash,
  FileText as PFileText,
  Gear as PGear,
  Hourglass as PHourglass,
  ImageSquare as PImageSquare,
  Images as PImages,
  Link as PLink,
  ListChecks as PListChecks,
  LockSimple as PLockSimple,
  MagnifyingGlass as PMagnifyingGlass,
  Newspaper as PNewspaper,
  Paperclip as PPaperclip,
  PaperPlaneTilt as PPaperPlaneTilt,
  PencilLine as PPencilLine,
  Play as PPlay,
  Plus as PPlus,
  Stop as PStop,
  Microphone as PMicrophone,
  MapPin as PMapPin,
  Trash as PTrash,
  Question as PQuestion,
  Scan as PScan,
  SealCheck as PSealCheck,
  ShareNetwork as PShareNetwork,
  Sparkle as PSparkle,
  Square as PSquare,
  TextT as PTextT,
  VideoCamera as PVideoCamera,
  SpinnerGap as PSpinnerGap,
  Warning as PWarning,
  WarningOctagon as PWarningOctagon,
  Waveform as PWaveform,
  X as PX,
  XCircle as PXCircle,
  type IconProps,
} from "phosphor-react-native";

export type Icon = ComponentType<{ size?: number; color?: string; style?: StyleProp<ViewStyle> }>;

/** Every icon of the app is a Phosphor duotone: the weight is fixed here, the colour comes from the caller. */
function duo(Base: ComponentType<IconProps>): Icon {
  const Duo: Icon = (props) => createElement(Base, { ...props, weight: "duotone" });
  Duo.displayName = `Duo(${Base.displayName ?? "Icon"})`;
  return Duo;
}

export const ArrowLeft = duo(PArrowLeft);
export const Lightning = duo(PLightning);
export const QrCode = duo(PQrCode);
export const Camera = duo(PCamera);
export const Stamp = duo(PStamp);
export const Phone = duo(PPhone);
export const Globe = duo(PGlobe);
export const Envelope = duo(PEnvelope);
export const ChartBar = duo(PChartBar);
export const AddressBook = duo(PAddressBook);
export const ArrowSquareOut = duo(PArrowSquareOut);
export const Broadcast = duo(PBroadcast);
export const CaretRight = duo(PCaretRight);
export const ChatTeardropText = duo(PChatTeardropText);
export const Check = duo(PCheck);
export const CheckSquare = duo(PCheckSquare);
export const Checks = duo(PChecks);
export const ClipboardText = duo(PClipboardText);
export const Clock = duo(PClock);
export const CloudArrowUp = duo(PCloudArrowUp);
export const CloudSlash = duo(PCloudSlash);
export const FileText = duo(PFileText);
export const Gear = duo(PGear);
export const Hourglass = duo(PHourglass);
export const ImageSquare = duo(PImageSquare);
export const Images = duo(PImages);
export const Link = duo(PLink);
export const ListChecks = duo(PListChecks);
export const LockSimple = duo(PLockSimple);
export const MagnifyingGlass = duo(PMagnifyingGlass);
export const Newspaper = duo(PNewspaper);
export const Paperclip = duo(PPaperclip);
export const PaperPlaneTilt = duo(PPaperPlaneTilt);
export const PencilLine = duo(PPencilLine);
export const Plus = duo(PPlus);
export const Question = duo(PQuestion);
export const Scan = duo(PScan);
export const SealCheck = duo(PSealCheck);
export const ShareNetwork = duo(PShareNetwork);
export const Sparkle = duo(PSparkle);
export const Square = duo(PSquare);
export const TextT = duo(PTextT);
export const VideoCamera = duo(PVideoCamera);
export const Warning = duo(PWarning);
export const WarningOctagon = duo(PWarningOctagon);
export const Waveform = duo(PWaveform);
export const X = duo(PX);
export const CheckCircle = duo(PCheckCircle);
export const CircleDashed = duo(PCircleDashed);
export const SpinnerGap = duo(PSpinnerGap);
export const XCircle = duo(PXCircle);
export const Play = duo(PPlay);
export const Stop = duo(PStop);
export const Microphone = duo(PMicrophone);
export const MapPin = duo(PMapPin);
export const Trash = duo(PTrash);
