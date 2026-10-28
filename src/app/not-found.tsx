import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="type-label text-ink/40">404</p>
      <h1 className="type-heading-sm text-ink">That peptide isn&apos;t on the shelf.</h1>
      <Link href="/" className="type-body-sm text-ink/60 underline decoration-ink/20 underline-offset-4 hover:text-ink">
        Back to the library
      </Link>
    </main>
  );
}
