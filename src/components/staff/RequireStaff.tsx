import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/primitives";
import { ShieldAlert } from "lucide-react";
import type { Role } from "@/lib/types";

export function RequireStaff({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { staff } = useAuth();
  const location = useLocation();

  if (!staff) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  if (roles && !roles.includes(staff.role)) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-6">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold">Ruxsat yo‘q</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sizning rolingiz ({staff.role}) bu bo‘limga kira olmaydi.
          </p>
          <a href={homeForRole(staff.role)} className="mt-5 inline-block">
            <Button>O‘z panelga qaytish</Button>
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
