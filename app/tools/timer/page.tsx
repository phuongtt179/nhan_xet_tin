'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw } from 'lucide-react';

const PRESETS = [
  { label: "1'", seconds: 60 },
  { label: "3'", seconds: 180 },
  { label: "5'", seconds: 300 },
  { label: "10'", seconds: 600 },
];

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const playTone = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.4);
    };
    playTone(0);
    playTone(0.45);
    playTone(0.9);
  } catch {
    // Trình duyệt không hỗ trợ Web Audio API — bỏ qua âm thanh
  }
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerPage() {
  const [duration, setDuration] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState(5);
  const [customSec, setCustomSec] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function setPreset(seconds: number) {
    setRunning(false);
    setDuration(seconds);
    setRemaining(seconds);
  }

  function applyCustom() {
    const seconds = Math.max(1, customMin * 60 + customSec);
    setPreset(seconds);
  }

  function toggleRunning() {
    if (remaining === 0) return;
    setRunning((prev) => !prev);
  }

  function reset() {
    setRunning(false);
    setRemaining(duration);
  }

  const isLow = remaining > 0 && remaining <= 10;
  const isDone = remaining === 0;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6 flex items-center gap-2">
        <TimerIcon className="text-blue-500" size={28} />
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Đồng hồ đếm ngược</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Hẹn giờ cho hoạt động thực hành</p>
        </div>
      </div>

      <div className="max-w-md mx-auto lg:mx-0 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.seconds}
              onClick={() => setPreset(p.seconds)}
              className={`flex-1 min-w-[60px] py-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                duration === p.seconds && !running
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Phút</label>
            <input
              type="number"
              min={0}
              max={59}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value))}
              className="w-full border-2 border-gray-300 rounded-lg p-2 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Giây</label>
            <input
              type="number"
              min={0}
              max={59}
              value={customSec}
              onChange={(e) => setCustomSec(Number(e.target.value))}
              className="w-full border-2 border-gray-300 rounded-lg p-2 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={applyCustom}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Đặt giờ
          </button>
        </div>

        <div
          className={`rounded-2xl p-10 flex items-center justify-center border-2 transition-colors ${
            isDone || isLow ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
          }`}
        >
          <div
            className={`font-mono font-bold tabular-nums ${isLow || isDone ? 'text-red-600' : 'text-gray-900'}`}
            style={{ fontSize: '4.5rem' }}
          >
            {formatTime(remaining)}
          </div>
        </div>

        {isDone && <div className="text-center text-red-600 font-semibold">⏰ Hết giờ!</div>}

        <div className="flex gap-2">
          <button
            onClick={toggleRunning}
            disabled={remaining === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 transition-colors text-base"
          >
            {running ? <Pause size={20} /> : <Play size={20} />}
            {running ? 'Tạm dừng' : 'Bắt đầu'}
          </button>
          <button
            onClick={reset}
            className="px-6 py-4 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Đặt lại
          </button>
        </div>
      </div>
    </div>
  );
}
