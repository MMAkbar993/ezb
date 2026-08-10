import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

/** Shared layout for the public marketplace routes. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </>
  )
}
