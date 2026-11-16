import { ClipboardList, Send } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { BoxIcon, Ornament } from "./ShopIcons";

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  { title: "Fill your box", text: "Tap the donuts you want. Change the amounts anytime before you send.", icon: <BoxIcon size={24} /> },
  { title: "Add delivery details", text: "Your name, mobile number, town, address and the day you want it.", icon: <ClipboardList size={24} aria-hidden="true" /> },
  { title: "Send your order", text: "We text or call to confirm it. You get a link to check on it any time.", icon: <Send size={24} aria-hidden="true" /> },
];

/** Three steps, joined by the same dotted leader as a printed menu. */
export default function HowToOrder() {
  return (
    <section id="how" className="how" aria-labelledby="how-title">
      <div className="how-head" data-reveal="">
        <Ornament className="shop-ornament" />
        <h2 id="how-title" className="how-title">How ordering works</h2>
      </div>
      <ol className="how-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="how-step" data-reveal="" style={{ "--reveal-i": index } as CSSProperties}>
            <span className="how-icon">{step.icon}</span>
            <h3 className="how-step-title">{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
