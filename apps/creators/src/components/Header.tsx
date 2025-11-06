import { Search, Eye } from 'lucide-react';
import { Button } from './ui/button';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search…"
            className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" className="gap-2 rounded-xl border-[#7A5FFF] text-[#7A5FFF] hover:bg-[#7A5FFF]/5">
          <Eye className="w-4 h-4" />
          Preview Brain
        </Button>
        <Button className="rounded-xl bg-[#7A5FFF] hover:bg-[#6B4FEF] text-white">
          Publish
        </Button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white ml-2">
          CB
        </div>
      </div>
    </header>
  );
}

