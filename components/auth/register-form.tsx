'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, RegisterInput } from '@/lib/validators';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { AlertTriangle, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsSubmitting(true);
    setApiError('');
    try {
      await registerUser(data.email, data.password, data.confirmPassword, 'student');
      router.push('/student/profile');
    } catch (error: any) {
      setApiError(error.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[calc(100%-32px)] sm:w-full max-w-[410px] mx-auto p-7 sm:p-8 bg-white rounded-[20px] border border-[#E2ECF8] shadow-[0_10px_35px_rgba(16,35,78,0.06)] font-sans-ui text-left">
      {/* 1. Branding Header */}
      <div className="flex justify-center mb-5 sm:mb-6">
        <BrandLogo size="md" showTagline={false} />
      </div>

      {/* 2. Heading */}
      <h1 className="text-[26px] sm:text-[28px] font-bold text-[#10234E] tracking-tight text-center mb-6">
        Sign Up
      </h1>

      {/* 3. API Error Alert */}
      {apiError && (
        <div className="p-3 mb-4 bg-rose-50 border border-rose-200/80 text-rose-700 text-xs sm:text-[13px] font-medium rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{apiError}</span>
        </div>
      )}

      {/* 4. Registration Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
        {/* Email Address */}
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

        {/* Password */}
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-[14px] font-semibold text-[#10234E]">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8] pointer-events-none" />
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className="w-full h-[46px] pl-10 pr-10 bg-white border border-[#D4E0F0] rounded-xl text-[14px] sm:text-[15px] text-[#10234E] placeholder:text-[#94A3B8] focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#94A3B8] hover:text-[#10234E] focus:outline-none transition-colors cursor-pointer"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-[18px] h-[18px]" />
              ) : (
                <Eye className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-rose-500 text-xs font-medium pl-1">{errors.confirmPassword.message}</p>
          )}
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
              <span>Registering Account...</span>
            </>
          ) : (
            <span>Sign Up</span>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="mt-5 sm:mt-6 text-center text-xs sm:text-[13px] text-[#64748B]">
        <span>Already have an account? </span>
        <Link
          href="/auth/login"
          className="font-semibold text-[#1760FF] hover:text-[#1250DF] hover:underline transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
