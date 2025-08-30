'use client';

import { Tag, X } from 'lucide-react';

interface CustomerTagProps {
  tag: string;
  onRemove?: () => void;
  clickable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'premium' | 'vip' | 'lead' | 'inactive' | 'custom';
}

export const CustomerTag: React.FC<CustomerTagProps> = ({
  tag,
  onRemove,
  clickable = false,
  size = 'md',
  variant = 'default',
}) => {
  // Gerar cor baseada no nome da tag de forma consistente
  const getTagColor = (tagName: string, variant: string) => {
    if (variant !== 'default' && variant !== 'custom') {
      const variants = {
        premium: 'bg-purple-100 text-purple-800 border-purple-200',
        vip: 'bg-amber-100 text-amber-800 border-amber-200',
        lead: 'bg-green-100 text-green-800 border-green-200',
        inactive: 'bg-gray-100 text-gray-600 border-gray-200',
      };
      return variants[variant as keyof typeof variants];
    }

    // Gerar cor baseada no hash da string
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-red-100 text-red-800 border-red-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-violet-100 text-violet-800 border-violet-200',
      'bg-lime-100 text-lime-800 border-lime-200',
    ];

    const hash = tagName.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  const getSizeClasses = (size: string) => {
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-1.5 text-base',
    };
    return sizes[size as keyof typeof sizes];
  };

  const getIconSize = (size: string) => {
    const iconSizes = {
      sm: 10,
      md: 12,
      lg: 16,
    };
    return iconSizes[size as keyof typeof iconSizes];
  };

  const colorClasses = getTagColor(tag, variant);
  const sizeClasses = getSizeClasses(size);
  const iconSize = getIconSize(size);

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium border
        ${colorClasses} ${sizeClasses}
        ${clickable ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}
      `}
    >
      <Tag size={iconSize} />
      <span>{tag}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
        >
          <X size={iconSize} />
        </button>
      )}
    </span>
  );
};

interface TagListProps {
  tags: string[];
  onRemoveTag?: (tag: string) => void;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  onRemoveTag,
  maxVisible = 5,
  size = 'md',
  clickable = false,
}) => {
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  if (tags.length === 0) {
    return (
      <span className="text-gray-400 text-sm italic">
        Nenhuma tag
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag, index) => (
        <CustomerTag
          key={index}
          tag={tag}
          onRemove={onRemoveTag ? () => onRemoveTag(tag) : undefined}
          size={size}
          clickable={clickable}
          variant={getTagVariant(tag)}
        />
      ))}
      
      {hiddenCount > 0 && (
        <span className={`
          inline-flex items-center rounded-full font-medium border
          bg-gray-100 text-gray-600 border-gray-200
          ${getSizeClasses(size)}
        `}>
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

// Helper para determinar variante da tag baseada no nome
const getTagVariant = (tag: string): CustomerTagProps['variant'] => {
  const lowercaseTag = tag.toLowerCase();
  
  if (lowercaseTag.includes('premium') || lowercaseTag.includes('plus')) {
    return 'premium';
  }
  if (lowercaseTag.includes('vip') || lowercaseTag.includes('gold')) {
    return 'vip';
  }
  if (lowercaseTag.includes('lead') || lowercaseTag.includes('prospect')) {
    return 'lead';
  }
  if (lowercaseTag.includes('inativo') || lowercaseTag.includes('suspenso')) {
    return 'inactive';
  }
  
  return 'default';
};

// Helper duplicada da função principal
const getSizeClasses = (size: string) => {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };
  return sizes[size as keyof typeof sizes];
};