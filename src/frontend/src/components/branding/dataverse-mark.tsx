import avatar from '../../assets/dataverse-avatar.webp'

export function DataVerseMark({ className }: { className: string }) {
  return <img className={className} src={avatar} alt="" width="44" height="44" />
}
