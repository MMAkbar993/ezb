import { redirect } from 'next/navigation'

// /marketplace is the public marketplace home, aliased to the root page.
export default function MarketplaceHomeRedirect() {
  redirect('/')
}
