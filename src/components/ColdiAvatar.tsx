import type { ColdiPose } from '../types/models';

interface ColdiAvatarProps {
  pose?: ColdiPose;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  floating?: boolean;
  rounded?: 'circle' | 'squircle';
  className?: string;
}

const POSE_SRC: Record<ColdiPose, { src: string; alt: string }> = {
  default: { src: './coldi-mascot.jpg', alt: 'Coldi sosteniendo su libro de Derecho' },
  reading: { src: './coldi-reading.jpg', alt: 'Coldi leyendo un libro jurídico' },
  writing: { src: './coldi-writing.jpg', alt: 'Coldi escribiendo sus apuntes' },
  thinking: { src: './coldi-thinking.jpg', alt: 'Coldi pensando con una idea' },
  music: { src: './coldi-music.jpg', alt: 'Coldi escuchando música relajante con su taza' },
};

const SIZE_CLASSES: Record<NonNullable<ColdiAvatarProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
};

export function ColdiAvatar({
  pose = 'default',
  size = 'md',
  floating = false,
  rounded = 'circle',
  className = '',
}: ColdiAvatarProps) {
  const { src, alt } = POSE_SRC[pose];
  const radiusClass = rounded === 'circle' ? 'rounded-full' : 'rounded-3xl';

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${radiusClass} bg-[#F8F1FB] dark:bg-[#2A203B] ring-2 ring-lavender-300/60 dark:ring-lavender-400/30 shadow-soft ${SIZE_CLASSES[size]} ${
        floating ? 'animate-float-slow' : ''
      } ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover scale-[1.06] dark:brightness-[0.95] dark:contrast-[1.03]"
      />
    </div>
  );
}
