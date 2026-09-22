import * as Icons from "lucide-react";
import { HelpCircle, type LucideProps } from "lucide-react";

export function DynamicIcon({ iconName, ...props }: { iconName?: string | null } & Omit<LucideProps, "name">) {
  const Icon = (iconName && (Icons as unknown as Record<string, Icons.LucideIcon>)[iconName]) || HelpCircle;
  return <Icon {...props} />;
}
