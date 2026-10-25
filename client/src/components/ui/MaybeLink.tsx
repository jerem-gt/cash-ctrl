import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { LINK_CLASS } from './linkStyles';

interface MaybeLinkProps {
  to?: string;
  children: ReactNode;
  className?: string;
}

export function MaybeLink({ to, children, className }: Readonly<MaybeLinkProps>) {
  if (to === undefined) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={className ? `${LINK_CLASS} ${className}` : LINK_CLASS}>
      {children}
    </Link>
  );
}
