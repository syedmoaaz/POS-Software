import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { isSuperAdminHost } from "@/lib/host";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const superAdminPortal = isSuperAdminHost();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = login(email, password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const user = useAuthStore.getState().user;
    if (superAdminPortal && user?.role !== "super_admin") {
      useAuthStore.getState().logout();
      toast.error("Use a Super Admin account on this portal");
      return;
    }
    toast.success("Welcome back");
    navigate(user?.role === "super_admin" ? "/admin" : "/dashboard");
  };

  return (
    <AuthShell superAdmin={superAdminPortal}>
      <h1 className="text-2xl font-extrabold text-ink">
        {superAdminPortal ? "Super Admin sign in" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {superAdminPortal
          ? "Platform console for tenants, plans, and subscriptions."
          : "Access your Mega Modern Solutions POS workspace."}
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {!superAdminPortal && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-semibold text-brand hover:underline" to="/login/pin">
            PIN login
          </Link>
          <Link className="text-ink-muted hover:underline" to="/forgot-password">
            Forgot password
          </Link>
          <Link className="text-ink-muted hover:underline" to="/onboarding">
            New business setup
          </Link>
        </div>
      )}
      <DemoAccounts superAdminOnly={superAdminPortal} />
    </AuthShell>
  );
}

export function PinLoginPage() {
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const navigate = useNavigate();
  const [pin, setPin] = useState("");

  if (isSuperAdminHost()) return <Navigate to="/login" replace />;

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold">Cashier PIN</h1>
      <p className="mt-1 text-sm text-ink-muted">Fast terminal access for register staff.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const result = loginWithPin(pin);
          if (!result.ok) return toast.error(result.message);
          toast.success("PIN accepted");
          navigate("/pos");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pin">4-digit PIN</Label>
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.4em]"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
            <Button
              key={key}
              type={key === "OK" ? "submit" : "button"}
              variant={key === "OK" ? "default" : "secondary"}
              size="touch"
              onClick={() => {
                if (key === "C") setPin("");
                else if (key !== "OK") setPin((p) => (p + key).slice(0, 6));
              }}
            >
              {key}
            </Button>
          ))}
        </div>
      </form>
      <Link className="mt-4 inline-block text-sm text-brand hover:underline" to="/login">
        Back to email login
      </Link>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold">Reset password</h1>
      <p className="mt-1 text-sm text-ink-muted">We'll email a secure reset link (mock).</p>
      {sent ? (
        <div className="mt-6 rounded-md border border-border bg-green-50 p-4 text-sm text-success">
          Reset link sent. Check your inbox.
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
            toast.success("Reset email queued");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required defaultValue="owner@karachimart.demo" />
          </div>
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
      <Link className="mt-4 inline-block text-sm text-brand hover:underline" to="/login">
        Back to login
      </Link>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold">Choose new password</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Password updated");
          navigate("/login");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="p1">New password</Label>
          <Input id="p1" type="password" required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p2">Confirm password</Label>
          <Input id="p2" type="password" required minLength={8} />
        </div>
        <Button className="w-full">Update password</Button>
      </form>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const steps = ["Business", "Branch", "Register", "Tax & receipt", "Invite team"];

  return (
    <AuthShell wide>
      <h1 className="text-2xl font-extrabold">Set up your business</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              i === step ? "bg-brand text-white" : i < step ? "bg-brand-muted text-brand" : "bg-surface-subtle text-ink-muted"
            }`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-lg border border-border bg-surface-subtle p-4">
        {step === 0 && (
          <>
            <Label>Business name</Label>
            <Input defaultValue="Karachi Mart" />
            <Label>Currency</Label>
            <Input defaultValue="PKR" />
          </>
        )}
        {step === 1 && (
          <>
            <Label>Branch name</Label>
            <Input defaultValue="Gulshan Branch" />
            <Label>Address</Label>
            <Input defaultValue="Gulshan-e-Iqbal, Karachi" />
          </>
        )}
        {step === 2 && (
          <>
            <Label>Register / counter</Label>
            <Input defaultValue="Counter 1" />
          </>
        )}
        {step === 3 && (
          <>
            <Label>Tax rate (%)</Label>
            <Input defaultValue="0" />
            <Label>Receipt footer</Label>
            <Input defaultValue="Thank you for shopping with us" />
          </>
        )}
        {step === 4 && (
          <>
            <Label>Invite email</Label>
            <Input defaultValue="cashier@karachimart.demo" />
          </>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button
          onClick={() => {
            if (step < steps.length - 1) setStep((s) => s + 1);
            else {
              toast.success("Business ready — sign in to continue");
              navigate("/login");
            }
          }}
        >
          {step === steps.length - 1 ? "Finish" : "Continue"}
        </Button>
      </div>
    </AuthShell>
  );
}

function AuthShell({
  children,
  wide,
  superAdmin,
}: {
  children: React.ReactNode;
  wide?: boolean;
  superAdmin?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#FDECEC,transparent_40%),radial-gradient(circle_at_bottom_right,#F7F7F7,transparent_45%)] px-4 py-10">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-xl border border-border bg-white p-6 shadow-sm`}>
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.jpeg" alt="Mega Modern Solutions" className="h-14 w-14 object-contain" />
          <div>
            <div className="text-lg font-extrabold tracking-wide text-brand">MEGA MODERN</div>
            <div className="text-xs font-semibold tracking-[0.22em] text-ink-muted">
              {superAdmin ? "SUPER ADMIN" : "SOLUTIONS POS"}
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function DemoAccounts({ superAdminOnly }: { superAdminOnly?: boolean }) {
  return (
    <div className="mt-6 rounded-md border border-dashed border-border bg-surface-subtle p-3 text-xs text-ink-muted">
      <div className="font-bold text-ink">Demo accounts</div>
      {superAdminOnly ? (
        <p className="mt-1">admin@megamodern.solutions / demo1234</p>
      ) : (
        <>
          <p className="mt-1">owner@karachimart.demo / demo1234</p>
          <p>cashier@karachimart.demo / demo1234 · PIN 1234</p>
          <p>admin@megamodern.solutions / demo1234</p>
        </>
      )}
    </div>
  );
}
