import { PlantSubnav } from '@/features/plants/components/PlantSubnav'

interface Props {
  children: React.ReactNode
  params: Promise<{ plantId: string }>
}

export default async function PlantLayout({ children, params }: Props) {
  const { plantId } = await params

  return (
    <div>
      <PlantSubnav plantId={plantId} />
      {children}
    </div>
  )
}
