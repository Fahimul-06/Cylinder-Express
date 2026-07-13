import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Headphones, MessageCircle, Phone, Send, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

type ChatMessage = {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  createdAt: number;
};

const STORAGE_KEY = 'cylinder-express-customer-care-chat';

const normalize = (value: string) => value.toLowerCase().trim();

export default function CustomerCareChat() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const copy = useMemo(() => language === 'bn' ? {
    title: 'কাস্টমার কেয়ার',
    online: 'চ্যাটবট অনলাইন',
    welcome: 'আসসালামু আলাইকুম! আমি Cylinder Express সহকারী। অর্ডার, ডেলিভারি, রিফিল, সার্ভিস বা অ্যাকাউন্ট বিষয়ে কীভাবে সাহায্য করতে পারি?',
    placeholder: 'আপনার বার্তা লিখুন...',
    send: 'পাঠান',
    quick: ['এলপিজি অর্ডার করব', 'আমার অর্ডার কোথায়?', 'রিফিল ও নতুন সিলিন্ডার', 'সার্ভিস বুকিং', 'কাস্টমার কেয়ারে কল'],
    human: 'সরাসরি সহায়তার জন্য 01967517077 অথবা 01409472939 নম্বরে কল করুন।',
  } : {
    title: 'Customer Care',
    online: 'Chatbot online',
    welcome: 'Hello! I am the Cylinder Express assistant. How can I help with an order, delivery, refill, service, or account?',
    placeholder: 'Type your message...',
    send: 'Send',
    quick: ['Order LPG cylinder', 'Where is my order?', 'Refill vs new cylinder', 'Book a service', 'Call customer care'],
    human: 'For direct support, call 01967517077 or 01409472939.',
  }, [language]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // Ignore invalid stored history.
    }
    return [];
  });

  useEffect(() => {
    if (!messages.length) {
      setMessages([{ id: crypto.randomUUID(), sender: 'bot', text: copy.welcome, createdAt: Date.now() }]);
    }
  }, [copy.welcome, messages.length]);

  useEffect(() => {
    if (messages.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, typing]);

  const answerFor = (raw: string) => {
    const q = normalize(raw);
    const bn = language === 'bn';

    if (/order|buy|cylinder|gas|এলপিজি|সিলিন্ডার|অর্ডার|গ্যাস/.test(q) && !/where|track|কোথায়|ট্র্যাক/.test(q)) {
      return {
        text: bn
          ? 'এলপিজি সিলিন্ডার দেখতে Products পেজে যান। একটি সিলিন্ডার খুলে New Cylinder অথবা Refill নির্বাচন করে কার্টে যোগ করুন।'
          : 'Open Products to view LPG cylinders. Select a cylinder, choose New Cylinder or Refill, then add it to your cart.',
        action: '/products',
      };
    }
    if (/where|track|status|delivery|কোথায়|ট্র্যাক|স্ট্যাটাস|ডেলিভারি/.test(q)) {
      return {
        text: bn
          ? 'আপনার অর্ডারের অবস্থা ও লাইভ ডেলিভারি দেখতে Profile Settings থেকে My Orders খুলুন।'
          : 'Open My Orders from Profile Settings to see order status and live delivery tracking.',
        action: '/orders',
      };
    }
    if (/refill|new cylinder|bottle|রিফিল|নতুন|বোতল/.test(q)) {
      return {
        text: bn
          ? 'Refill নিলে শুধু গ্যাসের মূল্য দিতে হবে। New Cylinder নিলে গ্যাসের মূল্য + বোতলের মূল্য যোগ হয়ে মোট দাম দেখাবে।'
          : 'Refill charges only the gas price. New Cylinder shows and charges gas price plus bottle price.',
      };
    }
    if (/service|install|stove|repair|সার্ভিস|ইনস্টল|চুলা|মেরামত/.test(q)) {
      return {
        text: bn
          ? 'Products & Services পেজ থেকে ইনস্টলেশন, গ্যাস স্টোভ এবং অন্যান্য সার্ভিস খুলে বুক করতে পারবেন।'
          : 'Open Products & Services to book installation, gas-stove, and other available services.',
        action: '/products',
      };
    }
    if (/address|location|ঠিকানা|লোকেশন/.test(q)) {
      return {
        text: bn
          ? 'Profile Settings থেকে Delivery Addresses খুলে ঠিকানা যোগ বা পরিবর্তন করুন। ডিভাইস লোকেশন দিলে জায়গার নাম দেখানো হবে।'
          : 'Open Delivery Addresses from Profile Settings to add or edit an address. Device location is displayed as a place name.',
        action: '/addresses',
      };
    }
    if (/usage|empty|next order|শেষ|খালি|ব্যবহার|পরবর্তী/.test(q)) {
      return {
        text: bn
          ? 'Cylinder Usage পেজে আনুমানিক গ্যাসের পরিমাণ, বাকি দিন এবং পরবর্তী অর্ডারের সম্ভাব্য তারিখ দেখতে পারবেন।'
          : 'Open Cylinder Usage to see estimated gas remaining, days left, and the predicted next-order date.',
        action: '/cylinder-usage',
      };
    }
    if (/password|login|account|পাসওয়ার্ড|লগইন|অ্যাকাউন্ট/.test(q)) {
      return {
        text: bn
          ? 'লগইন সমস্যায় Login পেজের Forgot Password অপশন ব্যবহার করুন। অন্য অ্যাকাউন্ট সমস্যায় কাস্টমার কেয়ারে কল করুন।'
          : 'For login problems, use Forgot Password on the login page. For other account issues, call customer care.',
      };
    }
    if (/call|human|agent|support|phone|কল|মানুষ|এজেন্ট|সহায়তা|ফোন/.test(q)) {
      return { text: copy.human };
    }
    if (/hello|hi|salam|আসসালাম|হ্যালো|হাই/.test(q)) {
      return { text: copy.welcome };
    }
    return {
      text: bn
        ? 'আমি অর্ডার, ডেলিভারি ট্র্যাকিং, রিফিল/নতুন সিলিন্ডার, ঠিকানা, সিলিন্ডার ব্যবহার, সার্ভিস ও অ্যাকাউন্ট বিষয়ে সাহায্য করতে পারি। নিচের একটি অপশনও বেছে নিতে পারেন।'
        : 'I can help with ordering, delivery tracking, refill/new-cylinder pricing, addresses, cylinder usage, services, and accounts. You can also choose a quick option below.',
    };
  };

  const submitMessage = (text: string) => {
    const value = text.trim();
    if (!value || typing) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), sender: 'user', text: value, createdAt: Date.now() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setTyping(true);

    window.setTimeout(() => {
      const response = answerFor(value);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), sender: 'bot', text: response.text, createdAt: Date.now() },
      ]);
      setTyping(false);
      if (response.action) {
        window.setTimeout(() => navigate(response.action!), 900);
      }
    }, 450);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitMessage(input);
  };

  return (
    <div className="fixed bottom-5 right-4 sm:right-6 z-[70]">
      {open && (
        <section className="mb-3 w-[calc(100vw-2rem)] sm:w-[380px] h-[560px] max-h-[76vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold leading-tight">{copy.title}</h2>
                <p className="text-xs text-blue-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-300 rounded-full" /> {copy.online}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close chat">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                }`}>
                  {message.sender === 'bot' && <Bot className="w-4 h-4 text-blue-600 mb-1" />}
                  {message.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:120ms]" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="px-3 pt-2 bg-white border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {copy.quick.map((item) => (
                <button
                  key={item}
                  onClick={() => submitMessage(item)}
                  className="shrink-0 text-xs px-3 py-2 rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-3 bg-white flex items-end gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.placeholder}
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
              aria-label={copy.send}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <div className="px-3 pb-3 bg-white grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/products')} className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
              <ShoppingCart className="w-3.5 h-3.5" /> {language === 'bn' ? 'পণ্য দেখুন' : 'View products'}
            </button>
            <a href="tel:01967517077" className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
              <Phone className="w-3.5 h-3.5" /> {language === 'bn' ? 'সরাসরি কল' : 'Call support'}
            </a>
          </div>
        </section>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="ml-auto relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center"
        aria-label={copy.title}
      >
        {open ? <X className="w-7 h-7" /> : <MessageCircle className="w-7 h-7" />}
        {!open && <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-green-400 border-2 border-white" />}
      </button>
    </div>
  );
}
