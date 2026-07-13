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
    quick: ['গ্যাস লিক হলে কী করব?', 'গ্যাস কীভাবে সাশ্রয় করব?', 'সিলিন্ডার দ্রুত শেষ হয় কেন?', 'রেগুলেটর ও পাইপ নিরাপত্তা', 'এলপিজি পণ্য দেখুন'],
    human: 'সরাসরি সহায়তার জন্য 01967517077 অথবা 01409472939 নম্বরে কল করুন।',
  } : {
    title: 'Customer Care',
    online: 'Chatbot online',
    welcome: 'Hello! I am the Cylinder Express assistant. How can I help with an order, delivery, refill, service, or account?',
    placeholder: 'Type your message...',
    send: 'Send',
    quick: ['What should I do if gas leaks?', 'How can I save gas?', 'Why did my cylinder finish quickly?', 'Regulator and hose safety', 'View LPG products'],
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

    // Emergency guidance must be checked before broad words such as "gas" or "cylinder".
    if (/leak|leaking|smell gas|gas smell|গ্যাস লিক|লিকেজ|গ্যাসের গন্ধ|গন্ধ পাচ্ছি|গন্ধ পাই/.test(q)) {
      return {
        text: bn
          ? '⚠️ গ্যাস লিক বা গ্যাসের গন্ধ পেলে:\n1. আগুন, ম্যাচ, লাইটার ও সিগারেট সঙ্গে সঙ্গে বন্ধ করুন।\n2. কোনো বৈদ্যুতিক সুইচ, ফ্যান, ফোন চার্জার বা যন্ত্র চালু/বন্ধ করবেন না।\n3. নিরাপদ হলে চুলার নব ও সিলিন্ডারের রেগুলেটর বন্ধ করুন।\n4. দরজা-জানালা হাতে খুলে বাতাস চলাচল করান।\n5. সবাইকে বাইরে নিয়ে যান এবং বাইরে গিয়ে 999 বা Cylinder Express সহায়তায় কল করুন।\n6. নিজে মেরামত করবেন না। প্রশিক্ষিত টেকনিশিয়ান পরীক্ষা না করা পর্যন্ত পুনরায় ব্যবহার করবেন না।'
          : '⚠️ If you smell gas or suspect an LPG leak:\n1. Extinguish flames, matches, lighters, and cigarettes immediately.\n2. Do not turn any electrical switch, fan, charger, or appliance on or off.\n3. If it is safe, close the stove knobs and cylinder regulator.\n4. Open doors and windows manually for ventilation.\n5. Move everyone outside, then call 999 or Cylinder Express support from outdoors.\n6. Do not attempt repairs. Do not reuse the system until a trained technician has checked it.',
      };
    }
    if (/save gas|gas saving|reduce gas|economy|সাশ্রয়|গ্যাস বাঁচ|কম গ্যাস|গ্যাস কম খরচ/.test(q)) {
      return {
        text: bn
          ? 'গ্যাস সাশ্রয়ের উপায়:\n• হাঁড়ির মাপ অনুযায়ী বার্নার ব্যবহার করুন এবং শিখা পাত্রের তলার বাইরে যেতে দেবেন না।\n• রান্নার সময় ঢাকনা ব্যবহার করুন; ডাল/মাংসে প্রেসার কুকার ব্যবহার করলে সময় কমে।\n• চাল, ডাল বা শক্ত খাবার আগে ভিজিয়ে রাখুন।\n• প্রয়োজনীয় উপকরণ আগে প্রস্তুত করে তারপর চুলা জ্বালান।\n• নীল শিখা নিশ্চিত করুন; হলুদ/কমলা শিখা হলে বার্নার পরিষ্কার বা সার্ভিস করান।\n• রান্না শেষে চুলার নব ও রেগুলেটর বন্ধ করুন।'
          : 'Ways to save LPG:\n• Match the burner to the pot and keep the flame under the pot base.\n• Cook with lids; use a pressure cooker for foods that take longer.\n• Soak rice, lentils, or other hard foods before cooking.\n• Prepare ingredients before lighting the stove.\n• Keep the flame blue; a yellow/orange flame may require burner cleaning or service.\n• Close both the stove knob and regulator after cooking.',
      };
    }
    if (/finish quickly|finished fast|fast finished|runs out fast|too much gas|দ্রুত শেষ|তাড়াতাড়ি শেষ|বেশি গ্যাস|কেন শেষ/.test(q)) {
      return {
        text: bn
          ? 'সিলিন্ডার দ্রুত শেষ হওয়ার সাধারণ কারণ:\n• পরিবারের সদস্য বা রান্নার সময় বেড়েছে\n• অতিরিক্ত বড় শিখা ব্যবহার করা\n• বার্নার আটকে থাকা বা হলুদ শিখা\n• পাইপ, রেগুলেটর, ভালভ বা সংযোগে ছোট লিক\n• চুলার নব/রেগুলেটর পুরোপুরি বন্ধ না করা\n• সিলিন্ডারের ওজন বা ধারণক্ষমতা আগেরটির চেয়ে কম হওয়া\n\nগ্যাসের গন্ধ, সাঁই সাঁই শব্দ বা সাবান-পানিতে বুদবুদ দেখা গেলে ব্যবহার বন্ধ করে টেকনিশিয়ান ডাকুন। আগুন দিয়ে কখনো লিক পরীক্ষা করবেন না।'
          : 'Common reasons a cylinder runs out unusually quickly:\n• More people or longer cooking time\n• Using an unnecessarily high flame\n• A blocked burner or yellow flame\n• A small leak at the hose, regulator, valve, or connection\n• Stove knobs or regulator not fully closed\n• A smaller cylinder capacity than the previous one\n\nIf you smell gas, hear hissing, or see bubbles during a soap-water check, stop using it and call a technician. Never test for leaks with a flame.',
      };
    }
    if (/regulator|hose|pipe|valve|রেগুলেটর|হোস|পাইপ|ভালভ/.test(q)) {
      return {
        text: bn
          ? 'রেগুলেটর ও পাইপ নিরাপত্তা:\n• অনুমোদিত মানের রেগুলেটর ও LPG হোস ব্যবহার করুন।\n• পাইপে ফাটল, শক্ত হয়ে যাওয়া, ঢিলা সংযোগ বা পোড়া দাগ আছে কি না নিয়মিত দেখুন।\n• পাইপ গরম চুলা, ধারালো প্রান্ত ও সরাসরি আগুন থেকে দূরে রাখুন।\n• সংযোগে সাবান-পানি লাগিয়ে বুদবুদ হচ্ছে কি না দেখা যায়; আগুন ব্যবহার করবেন না।\n• সমস্যা থাকলে নিজে খুলে মেরামত না করে সার্ভিস বুক করুন।'
          : 'Regulator and hose safety:\n• Use approved LPG regulators and hoses.\n• Regularly check for cracks, stiffness, loose connections, or burn marks.\n• Keep the hose away from the hot stove, sharp edges, and direct flame.\n• A soap-water bubble check can identify a connection leak; never use a flame.\n• Book a trained service technician instead of repairing it yourself.',
      };
    }
    if (/yellow flame|orange flame|black pot|soot|নীল শিখা|হলুদ শিখা|কমলা শিখা|কালো দাগ|কালি/.test(q)) {
      return {
        text: bn
          ? 'স্বাভাবিক LPG শিখা সাধারণত নীল হয়। হলুদ/কমলা শিখা, ধোঁয়া বা হাঁড়িতে কালো দাগ হলে বার্নারের ছিদ্র ময়লা হতে পারে, বাতাস-গ্যাস মিশ্রণ ঠিক নাও থাকতে পারে, অথবা চুলার সার্ভিস প্রয়োজন হতে পারে। চুলা বন্ধ ও ঠান্ডা করে বার্নার পরিষ্কার করুন; সমস্যা থাকলে টেকনিশিয়ান বুক করুন।'
          : 'A normal LPG flame is generally blue. Yellow/orange flame, smoke, or soot on pots can indicate blocked burner ports, poor air-gas mixing, or a stove that needs service. Turn the stove off, let it cool, clean the burner, and book a technician if the problem continues.',
      };
    }
    if (/cooking|cook|pressure cooker|burner|stove|রান্না|প্রেসার কুকার|বার্নার|চুলা/.test(q) && !/service|install|repair|সার্ভিস|ইনস্টল|মেরামত/.test(q)) {
      return {
        text: bn
          ? 'LPG রান্নায় পাত্র স্থিরভাবে বসান, হাতল আগুন থেকে দূরে রাখুন, রান্না চলাকালে চুলা একা ফেলে যাবেন না, দাহ্য কাপড়/কাগজ দূরে রাখুন এবং রান্নাঘরে বাতাস চলাচল নিশ্চিত করুন। রান্না শেষে প্রথমে চুলার নব, তারপর রেগুলেটর বন্ধ করুন।'
          : 'For LPG cooking, keep cookware stable, turn handles away from the flame, never leave cooking unattended, keep cloth and paper away, and maintain ventilation. After cooking, close the stove knob and then the regulator.',
      };
    }
    if (/product|accessory|regulator|hose|pipe|stove|burner|lighter|পণ্য|প্রোডাক্ট|এক্সেসরিজ|রেগুলেটর|পাইপ|চুলা|বার্নার/.test(q)) {
      return {
        text: bn
          ? 'Cylinder Express-এ LPG সিলিন্ডার, রিফিল, নতুন সিলিন্ডার, রেগুলেটর, LPG পাইপ/হোস, গ্যাস স্টোভ, বার্নার এবং সংশ্লিষ্ট পণ্য পাওয়া যায়। Products পেজে বর্তমান পণ্য, মূল্য ও স্টক দেখুন।'
          : 'Cylinder Express offers LPG refills, new cylinders, regulators, LPG hoses/pipes, gas stoves, burners, and related products. Open Products to see current items, prices, and availability.',
        action: '/products',
      };
    }
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
    if (/service|install|repair|সার্ভিস|ইনস্টল|মেরামত/.test(q)) {
      return {
        text: bn
          ? 'Products & Services পেজ থেকে সিলিন্ডার ইনস্টলেশন, গ্যাস স্টোভ ইনস্টলেশন, লিক পরীক্ষা এবং অন্যান্য সার্ভিস বুক করতে পারবেন। জরুরি লিক থাকলে আগে নিরাপদ স্থানে যান।'
          : 'Open Products & Services to book cylinder installation, stove installation, leak inspection, and other services. For an active leak, move to safety first.',
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
    if (/call|human|agent|support|phone|emergency|কল|মানুষ|এজেন্ট|সহায়তা|ফোন|জরুরি/.test(q)) {
      return { text: copy.human };
    }
    if (/hello|hi|salam|আসসালাম|হ্যালো|হাই/.test(q)) {
      return { text: copy.welcome };
    }
    return {
      text: bn
        ? 'আমি LPG নিরাপত্তা, গ্যাস লিক, গ্যাস সাশ্রয়, দ্রুত সিলিন্ডার শেষ হওয়া, রান্না, শিখার সমস্যা, রেগুলেটর, পাইপ, স্টোভ, পণ্য, অর্ডার, ডেলিভারি ও সার্ভিস বিষয়ে সাহায্য করতে পারি। আপনার প্রশ্নটি বিস্তারিত লিখুন।'
        : 'I can help with LPG safety, gas leaks, saving gas, unusually fast usage, cooking, flame problems, regulators, hoses, stoves, products, orders, delivery, and services. Please describe your question in detail.',
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
                } whitespace-pre-line`}>
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
