interface UniversityLogoProps {
  className?: string;
}

export function UniversityOfHillaCrest({ className = 'h-16 sm:h-20 w-auto' }: UniversityLogoProps) {
  return (
    <div className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
      <img
        src="/hilla-university-logo.png"
        alt="شعار جامعة الحلة"
        referrerPolicy="no-referrer"
        className={`${className} object-contain`}
      />
    </div>
  );
}

export function CollegeOfAdminEconLogo({ className = 'h-16 sm:h-20 w-auto' }: UniversityLogoProps) {
  return (
    <div className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
      <img
        src="/college-logo.png"
        alt="شعار كلية الإدارة والاقتصاد - جامعة الحلة"
        referrerPolicy="no-referrer"
        className={`${className} object-contain`}
      />
    </div>
  );
}
