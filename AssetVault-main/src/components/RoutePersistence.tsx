import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { saveLastRoute } from '../lib/lastRoute';

/** Keeps the current URL in session storage so refresh can restore it. */
export default function RoutePersistence() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    saveLastRoute(pathname, search);
  }, [pathname, search]);

  return null;
}
