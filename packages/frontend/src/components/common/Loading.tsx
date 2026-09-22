type Props = {
  source: string
}

function Loading({ source }: Props) {
  return (
    <div
      role="status"
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-white"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
      {import.meta.env.DEV && (
        <div className="text-xs text-neutral-500">
          {source}
        </div>
      )}
    </div>
  )
}

export default Loading
