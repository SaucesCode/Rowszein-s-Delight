import { useId, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { SHOP_EMAIL, SHOP_MESSENGER } from "./order";

type Field = "name" | "phone" | "message";
type Errors = Partial<Record<Field, string>>;

function validate(name: string, phone: string, message: string): Errors {
  const errors: Errors = {};
  if (!name.trim()) errors.name = "Enter your name.";
  if (!/^[+0-9()\-\s]{7,20}$/.test(phone.trim())) errors.phone = "Enter a phone number we can reach, like 0917 123 4567.";
  if (!message.trim()) errors.message = "Tell us what you'd like to ask or order.";
  return errors;
}

/** Questions and bigger orders, sent through Messenger or email. */
export default function ContactSection() {
  const ids = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [note, setNote] = useState<string | null>(null);

  const body = () => `Hi Rowszein's Delight!\n\nName: ${name.trim()}\nPhone: ${phone.trim()}\n\n${message.trim()}`;

  const check = () => {
    const found = validate(name, phone, message);
    setErrors(found);
    const first = (["name", "phone", "message"] as Field[]).find(field => found[field]);
    if (first) document.getElementById(`${ids}-${first}`)?.focus();
    return !first;
  };

  const sendMessenger = () => {
    if (!check()) return;
    window.open(SHOP_MESSENGER, "_blank", "noopener,noreferrer");
    if (!navigator.clipboard) {
      setNote("Messenger is open. Type your message there.");
      return;
    }
    navigator.clipboard.writeText(body()).then(
      () => setNote("Your message is copied. Paste it into the Messenger chat."),
      () => setNote("Messenger is open. Type your message there."),
    );
  };

  const sendEmail = () => {
    if (!check()) return;
    const subject = encodeURIComponent(`Question from ${name.trim()}`);
    window.location.href = `mailto:${SHOP_EMAIL}?subject=${subject}&body=${encodeURIComponent(body())}`;
  };

  const field = (key: Field) => ({
    id: `${ids}-${key}`,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `${ids}-${key}-error` : undefined,
  });

  const clearError = (key: Field) => {
    if (errors[key]) setErrors(current => ({ ...current, [key]: undefined }));
  };

  return (
    <section id="contact" className="shop-contact" aria-labelledby={`${ids}-title`}>
      <div className="shop-contact-intro">
        <h2 id={`${ids}-title`} className="shop-contact-title">Questions, or ordering for a party?</h2>
        <p>Send us a message and tell us what you need. We reply on Messenger or by email.</p>
        <ul className="shop-contact-ways">
          <li>
            <a href={SHOP_MESSENGER} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={20} aria-hidden="true" />
              <span>Message us on Messenger</span>
            </a>
          </li>
          <li>
            <a href={`mailto:${SHOP_EMAIL}`}>
              <Mail size={20} aria-hidden="true" />
              <span>{SHOP_EMAIL}</span>
            </a>
          </li>
        </ul>
      </div>

      <form
        className="shop-contact-form"
        noValidate
        onSubmit={event => {
          event.preventDefault();
          sendMessenger();
        }}
      >
        <div className="shop-contact-pair">
          <div>
            <label htmlFor={`${ids}-name`} className="field-label">Your name</label>
            <input
              {...field("name")}
              className="field-input"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={event => {
                setName(event.target.value);
                clearError("name");
              }}
            />
            {errors.name && <p id={`${ids}-name-error`} className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor={`${ids}-phone`} className="field-label">Phone number</label>
            <input
              {...field("phone")}
              className="field-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              value={phone}
              onChange={event => {
                setPhone(event.target.value);
                clearError("phone");
              }}
            />
            {errors.phone && <p id={`${ids}-phone-error`} className="field-error">{errors.phone}</p>}
          </div>
        </div>
        <div>
          <label htmlFor={`${ids}-message`} className="field-label">Message</label>
          <textarea
            {...field("message")}
            className="field-input"
            rows={4}
            maxLength={1000}
            value={message}
            placeholder="For example: two dozen for a birthday on Saturday afternoon."
            onChange={event => {
              setMessage(event.target.value);
              clearError("message");
            }}
          />
          {errors.message && <p id={`${ids}-message-error`} className="field-error">{errors.message}</p>}
        </div>
        <div className="shop-contact-actions">
          <button type="submit" className="btn-primary">Send on Messenger</button>
          <button type="button" className="btn-secondary" onClick={sendEmail}>Send by email</button>
        </div>
        <p className="shop-contact-note" role="status">{note}</p>
      </form>
    </section>
  );
}
