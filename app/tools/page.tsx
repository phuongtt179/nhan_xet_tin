'use client';

import Link from 'next/link';
import { Trophy, Dice5, Timer, LucideIcon } from 'lucide-react';

interface ToolCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const tools: ToolCard[] = [
  {
    href: '/tools/points',
    icon: Trophy,
    title: 'Điểm thưởng',
    description: 'Cộng/trừ điểm khi học sinh phát biểu, lưu lại và cộng dồn theo tiết.',
    color: 'bg-yellow-100 text-yellow-700',
  },
  {
    href: '/tools/random-picker',
    icon: Dice5,
    title: 'Chọn ngẫu nhiên',
    description: 'Gọi tên học sinh ngẫu nhiên để trả lời, công bằng cho cả lớp.',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    href: '/tools/timer',
    icon: Timer,
    title: 'Đồng hồ đếm ngược',
    description: 'Hẹn giờ cho hoạt động thực hành, báo khi hết giờ.',
    color: 'bg-blue-100 text-blue-700',
  },
];

export default function ToolsPage() {
  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Công cụ lớp học</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          Dùng ngay trong giờ dạy — không cần lưu, dùng xong là xong (trừ Điểm thưởng).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow flex items-start gap-4"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${tool.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{tool.title}</h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
