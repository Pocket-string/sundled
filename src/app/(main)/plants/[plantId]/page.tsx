import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ plantId: string }>
}

export default async function PlantDetailRedirect({ params }: Props) {
  const { plantId } = await params
  redirect(`/plants/${plantId}/dashboard`)
}
