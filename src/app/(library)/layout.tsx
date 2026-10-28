import { LibraryShell } from "@/components/shell/LibraryShell";

// The library (body, shelf, header) persists across the home view and every
// peptide page, so opening and closing a peptide can animate between them.
export default function LibraryLayout({ children }: LayoutProps<"/">) {
  return <LibraryShell>{children}</LibraryShell>;
}
