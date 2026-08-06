import "../styles/globals.css";
import { FollowProvider } from "../context/FollowContext";
import { VerificationProvider } from "../context/VerificationContext";
import { RoleProvider } from "../context/RoleContext";
import { ToastProvider } from "../components/ui/Toast";
import AnimatedBackground from "../components/AnimatedBackground";
import Script from "next/script";

export default function App({ Component, pageProps }) {
  return (
    <ToastProvider>
      <RoleProvider>
        <FollowProvider>
          <VerificationProvider>
            <Script
              src="https://checkout.razorpay.com/v1/checkout.js"
              strategy="afterInteractive"
            />
            <AnimatedBackground background="default" />
            <div id="main-content" tabIndex={-1}>
              <Component {...pageProps} />
            </div>
          </VerificationProvider>
        </FollowProvider>
      </RoleProvider>
    </ToastProvider>
  );
}
