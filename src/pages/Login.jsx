import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { authenticated, loading, login } = useAuth()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (authenticated) return <Navigate to="/" replace />

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    setError(false)

    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullPin = newPin.join('')
      if (fullPin.length === 6) {
        const success = login(fullPin)
        if (!success) {
          setError(true)
          setShake(true)
          setTimeout(() => {
            setShake(false)
            setPin(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
          }, 600)
        }
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newPin = pasted.split('')
      setPin(newPin)
      const success = login(pasted)
      if (!success) {
        setError(true)
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setPin(['', '', '', '', '', ''])
          inputRefs.current[0]?.focus()
        }, 600)
      }
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mb-6 shadow-lg">
        <span className="text-3xl text-white font-bold">F</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">FundTracker</h1>
      <p className="text-gray-500 mb-8 text-center">Enter your 6-digit PIN to continue</p>

      <div
        className={`flex gap-3 mb-6 ${shake ? 'animate-shake' : ''}`}
        onPaste={handlePaste}
      >
        {pin.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-200 ${
              error
                ? 'border-danger-400 bg-danger-50 text-danger-600'
                : digit
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-danger-500 text-sm font-medium animate-fade-in">
          Wrong PIN. Try again.
        </p>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}
