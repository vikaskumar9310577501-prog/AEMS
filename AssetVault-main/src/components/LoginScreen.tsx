import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { APP_NAME, LOGO_SRC } from '../lib/constants';
import { normalizeUser, useApp } from '../context/AppProvider';
import { parseJsonResponse } from '../lib/apiFetch';
import { resolvePostAuthRoute } from '../lib/lastRoute';

export default function LoginScreen() {
  const { loginSuccess } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const requestOtp = async () => {
    setLoginError('');
    if (!loginEmail) return setLoginError('Please enter email');
    const targetUrl = (import.meta.env.VITE_API_BASE_URL || "") + '/api/auth/request-otp';
    try {
      setLoginLoading(true);
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to request OTP');
      setOtpSent(true);
      toast.success('OTP sent to your email!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      requestOtp();
      return;
    }
    const targetUrl = (import.meta.env.VITE_API_BASE_URL || "") + '/api/auth/verify-otp';
    try {
      setLoginError('');
      setLoginLoading(true);
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, otp: loginOtp }),
      });
      const data = await parseJsonResponse<{ error?: string; user?: Record<string, unknown>; token?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');
      const userData = normalizeUser(data.user);
      loginSuccess(userData, data.token);
      toast.success(`Welcome, ${userData.role}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(resolvePostAuthRoute(from), { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-8 border border-gray-200">
          <div className="text-center space-y-4">
            <img src={LOGO_SRC} alt={`${APP_NAME} Logo`} className="mx-auto w-44 h-32 object-contain" />
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">{APP_NAME}</h1>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            {!otpSent ? (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 uppercase tracking-widest">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl text-gray-800 text-sm py-3.5 px-4 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="you@company.com"
                />
                {loginError && (
                  <p className="text-red-500 text-xs font-bold text-center mt-2">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading || !loginEmail.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs uppercase tracking-widest py-3.5 rounded-xl shadow hover:-translate-y-0.5 disabled:opacity-50 transition-all"
                >
                  {loginLoading ? 'Sending OTP...' : 'Request OTP ->'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 uppercase tracking-widest">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  required
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value)}
                  maxLength={6}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl text-center tracking-[0.5em] font-black text-2xl py-3.5 px-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="0 0 0 0 0 0"
                />
                {loginError && (
                  <p className="text-red-500 text-xs font-bold text-center mt-2">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs uppercase tracking-widest py-3.5 rounded-xl shadow hover:-translate-y-0.5 disabled:opacity-50 transition-all"
                >
                  {loginLoading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setLoginOtp('');
                  }}
                  className="w-full text-xs text-blue-600 font-bold mt-1 text-center hover:text-blue-800 transition-colors"
                >
                  Back to Email
                </button>
              </div>
            )}
          </form>
        </div>
        <p className="text-center text-gray-500 text-xs mt-6 uppercase tracking-widest">
          (c) {new Date().getFullYear()} {APP_NAME} - Secure Login
        </p>
      </div>
    </div>
  );
}
