import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { BookingModal, ProAvatar, PRIMARY, ACCENT, TEXT_MUTED, BORDER, BG_PAGE, BG_CARD } from "../components/BookingModal";
import PetAssistant from "../components/PetAssistant";

const PRODUCT_CATEGORIES = ["Ração", "Petiscos", "Acessórios", "Brinquedos", "Higiene"];

const STORE = {
  phone: "5534997654321",
  phoneDisplay: "(34) 99765-4321",
  address: "Avenida Rondon Pacheco, 1500 — Umuarama, Uberlândia – MG",
  hours: "Segunda a Sábado, das 8h às 18h",
};

function formatBRL(value) {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

const TESTIMONIALS = [
  { name: "Camila R.", pet: "tutora do Thor (golden retriever)", text: "O Thor sai de lá cheiroso e feliz. A Bianca é uma fofa e super cuidadosa com ele." },
  { name: "Marcos V.", pet: "tutor da Mel (gata persa)", text: "Difícil achar quem lide bem com gato arisco. A Rafaela tem uma paciência incrível." },
  { name: "Juliana P.", pet: "tutora do Bolt (poodle)", text: "Agendei pelo site em 2 minutos e o horário foi confirmado no mesmo dia. Recomendo muito!" },
];

export default function PublicSite() {
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCategory, setProductCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [initialServiceSlug, setInitialServiceSlug] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("pn_services").select("*").eq("active", true).order("price"),
      supabase.from("pn_professionals").select("*").eq("active", true).order("name"),
      supabase.from("pn_products").select("*").eq("active", true).order("category").order("name"),
    ]).then(([{ data: svc }, { data: pros }, { data: prod }]) => {
      setServices(svc || []);
      setProfessionals(pros || []);
      setProducts(prod || []);
      setLoading(false);
    });
  }, []);

  function openBooking(slug) {
    setInitialServiceSlug(slug || null);
    setBookingOpen(true);
  }

  const visibleProducts = useMemo(
    () => (productCategory === "Todos" ? products : products.filter((p) => p.category === productCategory)),
    [products, productCategory]
  );
  const featuredProducts = useMemo(() => products.filter((p) => p.featured), [products]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  }, []);

  function updateQty(productId, delta) {
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)).filter((i) => i.quantity > 0));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

  async function handleCheckout() {
    setCheckoutError("");
    if (!customerName.trim() || !customerPhone.trim()) {
      setCheckoutError("Preencha seu nome e telefone para finalizar.");
      return;
    }
    if (cart.length === 0) return;

    setCheckingOut(true);
    const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
    const { data: orderId, error } = await supabase.rpc("pn_create_order", {
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_customer_email: customerEmail.trim() || null,
      p_items: items,
    });
    setCheckingOut(false);

    if (error) {
      setCheckoutError("Não foi possível registrar o pedido. Tente novamente.");
      return;
    }

    const lines = cart.map((i) => `• ${i.quantity}x ${i.product.name} — ${formatBRL(i.product.price * i.quantity)}`);
    const text = [
      `Olá! Quero confirmar meu pedido #${orderId} na Patas Nobres 🐾`,
      "",
      ...lines,
      "",
      `Total: ${formatBRL(cartTotal)}`,
      `Nome: ${customerName.trim()}`,
    ].join("\n");

    window.open(`https://wa.me/${STORE.phone}?text=${encodeURIComponent(text)}`, "_blank");

    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCartOpen(false);
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: BG_PAGE, color: PRIMARY, minHeight: "100vh" }}>
      <Header onBook={() => openBooking(null)} cartCount={cartCount} onCartClick={() => setCartOpen(true)} />
      <Hero onBook={() => openBooking(null)} />

      <Section id="servicos" title="🛁 Serviços" subtitle="Banho, tosa e cuidado completo, com agendamento em poucos cliques">
        {loading ? (
          <p style={{ color: TEXT_MUTED }}>Carregando serviços...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
            {services.map((s) => (
              <div key={s.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "20px 18px", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, margin: "0 0 6px" }}>{s.name}</h3>
                <p style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5, flex: 1, margin: "0 0 14px" }}>{s.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{formatBRL(s.price)}</span>
                  <button onClick={() => openBooking(s.slug)} style={smallCta}>Agendar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {professionals.length > 0 && (
        <Section id="equipe" title="✂️ Nossa equipe" subtitle="Profissionais experientes que tratam seu pet com carinho">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {professionals.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 18px", flex: "1 1 260px" }}>
                <ProAvatar pro={p} size={52} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: PRIMARY }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: p.color, fontWeight: 600, marginBottom: 4 }}>{p.role_title}</div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{p.bio}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {featuredProducts.length > 0 && (
        <Section id="destaques" title="✨ Destaques da loja" subtitle="Nossas escolhas favoritas para o seu pet">
          <ProductGrid products={featuredProducts} onAdd={addToCart} />
        </Section>
      )}

      <Section id="loja" title="🛍️ Loja" subtitle="Ração, petiscos e acessórios selecionados para o seu pet">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {["Todos", ...PRODUCT_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setProductCategory(c)} style={{
              padding: "7px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: productCategory === c ? "none" : `1px solid ${BORDER}`,
              background: productCategory === c ? PRIMARY : "#fff",
              color: productCategory === c ? "#fff" : TEXT_MUTED,
            }}>
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <p style={{ color: TEXT_MUTED }}>Carregando produtos...</p>
        ) : (
          <ProductGrid products={visibleProducts} onAdd={addToCart} />
        )}
      </Section>

      <Testimonials />
      <About />
      <Contact onBook={() => openBooking(null)} />
      <Footer />

      {bookingOpen && (
        <BookingModal onClose={() => setBookingOpen(false)} initialServiceSlug={initialServiceSlug} />
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          total={cartTotal}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          onCheckout={handleCheckout}
          checkingOut={checkingOut}
          checkoutError={checkoutError}
        />
      )}

      <PetAssistant />
    </div>
  );
}

function Header({ onBook, cartCount, onCartClick }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: BG_PAGE, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
      <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🐾</div>
        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 19, color: PRIMARY }}>Patas Nobres</span>
      </a>

      <nav style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <a href="#servicos" style={navLink}>Serviços</a>
        <a href="#loja" style={navLink}>Loja</a>
        <a href="#contato" style={navLink}>Contato</a>
        <button onClick={onBook} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Agendar
        </button>
        <button
          onClick={onCartClick}
          style={{
            position: "relative", background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          🛒
          {cartCount > 0 && (
            <span style={{ background: PRIMARY, color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {cartCount}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
}

function ProductGrid({ products, onAdd }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAdd={onAdd} />
      ))}
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `${product.cover_color}22`, padding: "26px 16px", textAlign: "center", fontSize: 40 }}>
        {product.cover_emoji}
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: product.cover_color, textTransform: "uppercase", letterSpacing: 0.4 }}>{product.category}</span>
        <h3 style={{ fontSize: 14.5, fontWeight: 700, color: PRIMARY, margin: "4px 0 2px" }}>{product.name}</h3>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "8px 0", flex: 1, lineHeight: 1.5 }}>{product.description}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: PRIMARY }}>{formatBRL(product.price)}</span>
        </div>
        <button
          onClick={() => onAdd(product)}
          disabled={product.stock <= 0}
          style={{
            marginTop: "auto", background: product.stock > 0 ? PRIMARY : BORDER, color: "#fff", border: "none",
            borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: product.stock > 0 ? "pointer" : "not-allowed",
          }}
        >
          {product.stock > 0 ? "Adicionar ao carrinho" : "Esgotado"}
        </button>
      </div>
    </div>
  );
}

function CartDrawer({
  cart, total, onClose, onUpdateQty, onRemove,
  customerName, setCustomerName, customerPhone, setCustomerPhone, customerEmail, setCustomerEmail,
  onCheckout, checkingOut, checkoutError,
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,58,36,0.4)", zIndex: 600 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 601, width: "min(400px, 100vw)", background: "#fff", boxShadow: "-8px 0 30px rgba(31,58,36,0.2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, margin: 0 }}>🛒 Seu carrinho</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: TEXT_MUTED }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {cart.length === 0 ? (
            <p style={{ color: TEXT_MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
              Seu carrinho está vazio. <a href="#loja" onClick={onClose} style={{ color: PRIMARY }}>Ver loja</a>
            </p>
          ) : (
            cart.map(({ product, quantity }) => (
              <div key={product.id} style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${product.cover_color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {product.cover_emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{product.name}</div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>{formatBRL(product.price)} cada</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <button onClick={() => onUpdateQty(product.id, -1)} style={qtyBtn}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{quantity}</span>
                    <button onClick={() => onUpdateQty(product.id, 1)} style={qtyBtn}>+</button>
                    <button onClick={() => onRemove(product.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#B5384C", fontSize: 12, cursor: "pointer" }}>Remover</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: PRIMARY, marginBottom: 14 }}>
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>

            <input placeholder="Seu nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={cartInput} />
            <input placeholder="WhatsApp (com DDD)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ ...cartInput, marginTop: 8 }} />
            <input placeholder="E-mail (opcional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ ...cartInput, marginTop: 8 }} />

            {checkoutError && <p style={{ color: "#B5384C", fontSize: 12, marginTop: 8 }}>{checkoutError}</p>}

            <button
              onClick={onCheckout}
              disabled={checkingOut}
              style={{ marginTop: 12, width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: checkingOut ? "wait" : "pointer", opacity: checkingOut ? 0.7 : 1 }}
            >
              {checkingOut ? "Enviando..." : "Finalizar pedido no WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const qtyBtn = { width: 24, height: 24, borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1 };
const cartInput = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };


const navLink = { color: TEXT_MUTED, textDecoration: "none", fontSize: 14, fontWeight: 600 };

function Hero({ onBook }) {
  return (
    <section style={{ background: `linear-gradient(160deg, #1F3A24 0%, ${PRIMARY} 100%)`, color: "#fff", padding: "72px 28px", textAlign: "center" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: ACCENT }}>
          🐾 Banho, tosa e loja para o seu pet
        </span>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, margin: "14px 0", lineHeight: 1.2 }}>
          Cuidado de verdade para quem é da família
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
          Agende banho e tosa online, encontre tudo para o seu pet na nossa loja e receba lembretes de cuidado —
          tudo em um só lugar.
        </p>
        <button onClick={onBook} style={{ display: "inline-block", marginTop: 22, background: ACCENT, color: "#fff", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
          Agendar banho e tosa
        </button>
      </div>
    </section>
  );
}

function Section({ id, title, subtitle, children }) {
  return (
    <section id={id} style={{ padding: "48px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: PRIMARY, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 14, color: TEXT_MUTED, marginBottom: 24 }}>{subtitle}</p>
      {children}
    </section>
  );
}

const smallCta = { background: BG_CARD, color: PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };

function Testimonials() {
  return (
    <section style={{ background: BG_CARD, padding: "48px 28px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: PRIMARY, marginBottom: 24, textAlign: "center" }}>O que os tutores dizem</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, color: PRIMARY, lineHeight: 1.6, fontStyle: "italic", marginBottom: 12 }}>"{t.text}"</p>
              <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{t.name}</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED }}>{t.pet}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="sobre" style={{ padding: "48px 28px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: PRIMARY, marginBottom: 12 }}>Sobre a Patas Nobres</h2>
        <p style={{ fontSize: 14, color: TEXT_MUTED, lineHeight: 1.7 }}>
          Somos um pet shop completo pensado para quem trata o pet como parte da família: banho e tosa com
          profissionais experientes, loja com ração e acessórios selecionados, e cuidado que acompanha a história
          de cada pet — do primeiro banho ao próximo agendamento.
        </p>
      </div>
    </section>
  );
}

function Contact({ onBook }) {
  return (
    <section id="contato" style={{ padding: "48px 28px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: PRIMARY, marginBottom: 16 }}>Visite ou fale conosco</h2>
      <p style={{ fontSize: 14, color: TEXT_MUTED, margin: "6px 0" }}>📍 {STORE.address}</p>
      <p style={{ fontSize: 14, color: TEXT_MUTED, margin: "6px 0" }}>🕐 {STORE.hours}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={onBook} style={{ background: PRIMARY, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          🐾 Agendar banho e tosa
        </button>
        <a href={`https://wa.me/${STORE.phone}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#25D366", color: "#fff", padding: "10px 22px", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          💬 WhatsApp {STORE.phoneDisplay}
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "#1F3A24", color: "rgba(255,255,255,0.7)", padding: "24px 28px", textAlign: "center", fontSize: 12 }}>
      <p>© {new Date().getFullYear()} Patas Nobres — banho, tosa e loja para o seu pet</p>
      <a href="/admin/login" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline", fontSize: 12 }}>Acesso da equipe</a>
    </footer>
  );
}
