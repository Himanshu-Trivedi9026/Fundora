import "../styles/globals.css";
import { FollowProvider } from "../context/FollowContext";
import AnimatedBackground from "../components/AnimatedBackground";
import Script from "next/script";

export default function App({ Component, pageProps }) {
  return (
    <FollowProvider>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <AnimatedBackground background="default" />
      <Component {...pageProps} />
    </FollowProvider>
  );
}
