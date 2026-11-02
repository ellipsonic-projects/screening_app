'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Save, User, Mail, Phone, School, IdCard, GitBranch } from 'lucide-react';
import { StudentProfileSchema, StudentProfileInput } from '@/lib/validators';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export function ProfileForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<StudentProfileInput>({
    resolver: zodResolver(StudentProfileSchema) as any,
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
      college: '',
      usn: '',
      branchName: '',
      cameraPermission: true,
      microphonePermission: true,
    },
  });

  // Fetch existing profile
  useEffect(() => {
    fetchExistingProfile();
  }, []);

  const fetchExistingProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/students/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.student) {
        const fetchedData: StudentProfileInput = {
          email: response.data.student.email || user?.email || '',
          fullName: response.data.student.fullName || '',
          phone: response.data.student.phone || '',
          college: response.data.student.college || '',
          usn: response.data.student.usn || '',
          branchName: response.data.student.branchName || '',
          cameraPermission: true,
          microphonePermission: true,
        };
        reset(fetchedData);
      }
    } catch (error) {
      // If 404, we just use empty defaults with the auth user's email if possible
      if (user?.email) {
        reset({
          email: user.email,
          fullName: '',
          phone: '',
          college: '',
          usn: '',
          branchName: '',
          cameraPermission: true,
          microphonePermission: true,
        });
      }
    }
  };

  const onSubmit = async (data: StudentProfileInput) => {
    setIsSubmitting(true);
    setApiError('');
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...data,
        cameraPermission: true,
        microphonePermission: true
      };
      
      await axios.post('/api/students/profile', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      reset(data); // reset the form with the new data so isDirty becomes false
      toast.success('Profile updated successfully');
      router.push('/student/dashboard');
    } catch (error: any) {
      console.error('[Frontend] API Error:', error.response?.data || error.message || error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to save profile';
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Top Header Section */}
      <div className="space-y-1 sm:space-y-1.5">
        <h1 className="text-[26px] sm:text-[32px] font-bold text-[#10234E] tracking-tight leading-tight">
          Candidate Profile
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#607797] font-normal">
          Review and update your academic details and contact information.
        </p>
      </div>

      {/* Main Profile Form Card */}
      <div className="p-6 sm:p-9 bg-white rounded-2xl sm:rounded-[22px] border border-[#DCE5F0] shadow-[0_2px_12px_rgba(16,35,78,0.03)] space-y-7">
        {apiError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 stroke-[2.2]" />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field (Read-only) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#607797]" />
                <span>Email Address</span>
              </label>
              <span className="text-[11px] font-semibold text-[#1760FF] bg-[#EEF5FF] px-2.5 py-0.5 rounded-md border border-[#BFDBFE]/60">
                Primary Account (Read-Only)
              </span>
            </div>
            <input
              {...register('email')}
              type="email"
              readOnly
              className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-[#F8FAFC] text-[#607797] text-sm font-medium cursor-not-allowed select-none outline-none shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
              placeholder="Email Address"
            />
            {errors.email && (
              <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{String(errors.email.message)}</span>
              </p>
            )}
          </div>

          {/* Full Name & Phone Number (Two-Column) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#607797]" />
                <span>Full Name</span>
              </label>
              <input
                {...register('fullName')}
                type="text"
                className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-white text-[#10234E] placeholder:text-[#94A3B8] text-sm font-medium focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 transition-all outline-none shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
                placeholder="Enter full name"
              />
              {errors.fullName && (
                <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{String(errors.fullName.message)}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#607797]" />
                <span>Phone Number</span>
              </label>
              <input
                {...register('phone')}
                type="tel"
                maxLength={10}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-white text-[#10234E] placeholder:text-[#94A3B8] text-sm font-medium focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 transition-all outline-none shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
                placeholder="10-digit mobile number"
              />
              {errors.phone && (
                <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{String(errors.phone.message)}</span>
                </p>
              )}
            </div>
          </div>

          {/* College Name & USN / Roll Number (Two-Column) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-[#607797]" />
                <span>College / Institution</span>
              </label>
              <input
                {...register('college')}
                type="text"
                className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-white text-[#10234E] placeholder:text-[#94A3B8] text-sm font-medium focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 transition-all outline-none shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
                placeholder="College or university name"
              />
              {errors.college && (
                <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{String(errors.college.message)}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-[#607797]" />
                <span>USN / Roll Number</span>
              </label>
              <input
                {...register('usn')}
                type="text"
                className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-white text-[#10234E] placeholder:text-[#94A3B8] text-sm font-medium focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 transition-all outline-none uppercase shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
                placeholder="e.g. 1MS21CS001"
              />
              {errors.usn && (
                <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{String(errors.usn.message)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Academic Branch */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#10234E] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#607797]" />
              <span>Academic Branch</span>
            </label>
            <input
              {...register('branchName')}
              type="text"
              className="w-full h-[48px] px-4 rounded-xl border border-[#DCE5F0] bg-white text-[#10234E] placeholder:text-[#94A3B8] text-sm font-medium focus:border-[#1760FF] focus:ring-4 focus:ring-[#1760FF]/10 transition-all outline-none shadow-[0_1px_2px_rgba(16,35,78,0.02)]"
              placeholder="e.g. Computer Science and Engineering"
            />
            {errors.branchName && (
              <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{String(errors.branchName.message)}</span>
              </p>
            )}
          </div>

          {/* Footer Action Area */}
          <div className="pt-6 border-t border-[#EEF3FA] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#607797] font-medium order-2 sm:order-1 text-center sm:text-left">
              Ensure details match your official college records.
            </p>

            <button
              type="submit"
              disabled={!isDirty || isSubmitting}
              className="h-[48px] px-8 bg-[#1760FF] hover:bg-[#1250DF] active:scale-[0.99] text-white font-semibold text-[15px] rounded-xl shadow-[0_4px_14px_rgba(23,96,255,0.25)] hover:shadow-[0_6px_20px_rgba(23,96,255,0.3)] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none order-1 sm:order-2 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 stroke-[2.2]" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
