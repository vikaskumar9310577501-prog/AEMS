import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppProvider';
import { resolveDefaultRouteForUser } from '../lib/userPermissions';

interface RouteGuardProps {
  allowed: boolean;
  fallbackPath?: string;
  children: React.ReactNode;
}

export default function RouteGuard({ allowed, fallbackPath, children }: RouteGuardProps) {
  const { user } = useApp();

  if (!allowed) {
    const target = fallbackPath || resolveDefaultRouteForUser(user);
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
