import { useAppVersion } from '../hooks/useAppVersion.ts';

export function VersionStatus() {
  const { version, isOnline } = useAppVersion();

  return (
    <div className="flex items-center gap-2 px-5 py-2 transition-opacity duration-300 cursor-default opacity-40 hover:opacity-100">
      <div
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
        version {version}
      </span>
    </div>
  );
}
