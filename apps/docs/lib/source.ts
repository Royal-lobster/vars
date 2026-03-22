import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import * as simpleIcons from '@icons-pack/react-simple-icons';
import { createElement } from 'react';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) return;

    // Check simple-icons first (Si* prefix)
    if (icon.startsWith('Si') && icon in simpleIcons) {
      return createElement(
        (simpleIcons as Record<string, React.ComponentType<{ size?: number }>>)[icon],
        { size: 16 },
      );
    }

    // Fall back to lucide-react
    if (icon in icons) {
      return createElement(icons[icon as keyof typeof icons]);
    }
  },
});
