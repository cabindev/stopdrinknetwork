//app/auth/signin/page.tsx
import { Suspense } from "react";
import SignInForm from "@/app/components/auth/SignInForm";

// SignInForm อ่าน ?callbackUrl= / ?error= ด้วย useSearchParams จึงต้องอยู่ใน Suspense
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
