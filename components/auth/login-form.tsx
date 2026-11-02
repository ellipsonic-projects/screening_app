'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, BadgeCheck, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { LoginSchema, LoginInput } from '@/lib/validators';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { BrandLogo } from '@/components/common/BrandLogo';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => setMounted(true), []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setIsSubmitting(true);
    try {
      if (resetStep === 1) {
        if (!resetEmail) throw new Error('Email is required');
        const res = await fetch('/api/auth/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error?.message || 'Failed to send OTP');
        setResetSuccess('OTP sent to your email!');
        setResetStep(2);
      } else if (resetStep === 2) {
        if (!resetOtp) throw new Error('OTP is required');
        setResetStep(3);
        setResetSuccess('OTP verified. Enter your new password.');
      } else if (resetStep === 3) {
        if (!resetNewPassword) throw new Error('New password is required');
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword: resetNewPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error?.message || 'Reset failed');
        setResetSuccess('Password reset successful! You can now sign in.');
        setTimeout(() => {
          setIsForgotPassword(false);
          setResetStep(1);
          setResetSuccess('');
          setResetEmail('');
          setResetOtp('');
          setResetNewPassword('');
        }, 3000);
      }
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true);
    setApiError('');
    try {
      const user = await login(data.email, data.password);
      if (user.role === 'admin' || user.role === 'super_admin') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/student/dashboard';
      }
    } catch (error: any) {
      setApiError(error.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="w-[calc(100%-32px)] sm:w-full max-w-[410px] mx-auto p-7 sm:p-8 bg-white rounded-[20px] border border-[#E2ECF8] shadow-[0_10px_35px_rgba(16,35,78,0.06)] font-sans-ui text-left">
      {/* 1. Branding Header */}
      <div className="flex justify-center mb-5 sm:mb-6">
        <BrandLogo size="md" showTagline={false} />
      </div>

      {isForgotPassword ? (
        /* Forgot Password 3-Step Flow */
        <div>
          <h1 className="text-[24px] sm:text-[26px] font-bold text-[#10234E] tracking-tight text-center mb-2">
            Reset Password
          </h1>
          <p className="text-xs sm:text-[13px] text-[#64748B] text-center mb-6">
            {resetStep === 1 && 'Enter your email to receive a verification OTP.'}
            {resetStep === 2 && 'Enter the 6-digit OTP code sent to your email.'}
            {resetStep === 3 && 'Create a new secure password for your account.'}
          </p>

          {resetError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200/80 text-rose-700 text-xs sm:text-[13px] font-medium rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{resetError}</span>
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs sm:text-[13px] font-medium rounded-xl flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{resetSuccess}</span>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-3.5 sm:space-y-4">
            {resetStep === 1 && (
              <div className="space-y-1.5">
                <label className="block text-[14px] font-semibold text-[#10234E]">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full h-[46px] pl-10 pr-3.5 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {resetStep === 2 && (
              <div className="space-y-1.5">
                <label className="block text-[14px] font-semibold text-[#10234E]">
                  Verification OTP
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
                  <input
                    type="text"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    required
                    className="w-full h-[46px] pl-10 pr-3.5 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {resetStep === 3 && (
              <div className="space-y-1.5">
                <label className="block text-[14px] font-semibold text-[#10234E]">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
                  <input
                    type="password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="w-full h-[46px] pl-10 pr-3.5 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[46px] sm:h-[48px] mt-5 bg-[#1760FF] hover:bg-[#1250DF] active:scale-[0.99] text-white font-semibold text-[14px] sm:text-[15px] rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>
                  {resetStep === 1 ? 'Send OTP' : resetStep === 2 ? 'Verify OTP' : 'Reset Password'}
                </span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetStep(1);
                  setResetSuccess('');
                  setResetError('');
                }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#1760FF] hover:text-[#1250DF] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Standard Sign In Form */
        <>
          <h1 className="text-[26px] sm:text-[28px] font-bold text-[#10234E] tracking-tight text-center mb-6">
            Sign In
          </h1>

          {apiError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200/80 text-rose-700 text-xs sm:text-[13px] font-medium rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
            {/* Email Address Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[14px] font-semibold text-[#10234E]">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="w-full h-[46px] pl-10 pr-3.5 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-rose-500 text-xs font-medium pl-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[14px] font-semibold text-[#10234E]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="w-full h-[46px] pl-10 pr-10 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#94A3B8] hover:text-[#10234E] focus:outline-none transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-500 text-xs font-medium pl-1">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end pt-1 pb-0.5">
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-xs sm:text-[13px] font-semibold text-[#1760FF] hover:text-[#1250DF] transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[46px] sm:h-[48px] mt-5 bg-[#1760FF] hover:bg-[#1250DF] active:scale-[0.99] text-white font-semibold text-[14px] sm:text-[15px] rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-5 sm:mt-6 text-center text-xs sm:text-[13px] text-[#64748B]">
            <span>Don&apos;t have an account? </span>
            <Link
              href="/auth/register"
              className="font-semibold text-[#1760FF] hover:text-[#1250DF] hover:underline transition-colors"
            >
              Sign up
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
