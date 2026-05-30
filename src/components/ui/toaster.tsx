import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, onClick, className, ...props }) {
        return (
          <Toast
            key={id}
            className={cn(className)}
            onClick={
              onClick
                ? (e) => {
                    if ((e.target as HTMLElement).closest("[toast-close]")) {
                      return
                    }
                    onClick(e)
                  }
                : undefined
            }
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
