import { FileImage, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { BoxIcon } from "./ShopIcons";

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  { title: "Fill your box", text: "Tap the donuts you want. Change the amounts anytime before you send.", icon: <BoxIcon size={24} /> },
  { title: "Save your order card", text: "Add your name and save the card. It lists every donut and the total.", icon: <FileImage size={24} aria-hidden="true" /> },
  { title: "Send it on Messenger", text: "Send the card to us on Messenger. We reply to confirm your order.", icon: <MessageCircle size={24} aria-hidden="true" /> },
];

/** Three steps, joined by the same dotted leader as a printed menu. */
export default function HowToOrder() {
  return (
    <section id="how" className="how" aria-labelledby="how-title">
      <h2 id="how-title" className="how-title">How ordering works</h2>
      <ol className="how-steps">
        {STEPS.map(step => (
          <li key={step.title} className="how-step">
            <span className="how-icon">{step.icon}</span>
            <h3 className="how-step-title">{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
