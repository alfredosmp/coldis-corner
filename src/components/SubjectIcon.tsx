import {
  BookOpen,
  Feather,
  Gavel,
  Heart,
  Landmark,
  Scale,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import type { SubjectIconId } from '../types/models';

interface SubjectIconProps {
  icon: SubjectIconId;
  className?: string;
}

export function SubjectIcon({ icon, className = 'w-5 h-5' }: SubjectIconProps) {
  switch (icon) {
    case 'scale':
      return <Scale className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'gavel':
      return <Gavel className={className} />;
    case 'scroll':
      return <ScrollText className={className} />;
    case 'landmark':
      return <Landmark className={className} />;
    case 'feather':
      return <Feather className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    default:
      return <Scale className={className} />;
  }
}
