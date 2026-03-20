import { cn } from "@/lib/utils";

const BRAND_LOGO_SRC = "/divinedesk%20logo.jpeg";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({ className, alt = "DivineDesk logo" }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
