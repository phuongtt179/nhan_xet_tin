export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-500 to-purple-600">
      {children}
    </div>
  );
}
