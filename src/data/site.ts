export const navItems = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export const processSteps = [
  {
    title: "Share their photos",
    body: "Upload several photographs that show their face, markings, and shape from different angles.",
  },
  {
    title: "We create their portrait",
    body: "Your photographs guide a portrait designed specifically for shallow wood relief carving.",
  },
  {
    title: "You approve it",
    body: "You see the portrait before anything is carved and can request a revision.",
  },
  {
    title: "We make their memorial",
    body: "The approved design is precision-carved in wood and individually finished.",
  },
];

export const woods = [
  {
    name: "Walnut",
    note: "Deep brown grain with a quiet, furniture-like presence.",
    color: "#6b442d",
  },
  {
    name: "White oak",
    note: "Pale, structured grain with a calm modern feel.",
    color: "#b29a78",
  },
  {
    name: "Maple",
    note: "Light and understated, suitable for softer interiors.",
    color: "#d4c3a5",
  },
  {
    name: "Cherry",
    note: "Warm reddish tone that deepens naturally over time.",
    color: "#9b573e",
  },
];

export const faqItems = [
  {
    question: "How many photos should I upload?",
    answer: "Several photos are best. A clear face photo, a three-quarter view, and a side view usually give us a stronger sense of the pet.",
  },
  {
    question: "Will the carving look exactly like my photograph?",
    answer: "The portrait is an interpretation designed for wood relief carving, not a photographic reproduction. The goal is recognizable and restrained.",
  },
  {
    question: "Can I see the design before it is carved?",
    answer: "Yes. We do not carve the final piece until you approve the portrait.",
  },
  {
    question: "Can I request changes?",
    answer: "Yes. The proofing step exists so you can ask for practical adjustments before production begins.",
  },
  {
    question: "How large an urn do I need?",
    answer: "The order flow will recommend a size based on your pet's weight once final dimensions and capacities are confirmed.",
  },
  {
    question: "Do you reuse customer photos in the gallery?",
    answer: "No. Customer photos and memorials are private unless a customer explicitly opts in to sharing.",
  },
];

export const productOptions = {
  sizes: [
    { id: "small", name: "Small", detail: "For smaller companions", price: 320 },
    { id: "medium", name: "Medium", detail: "Most common dog and cat size", price: 420 },
    { id: "large", name: "Large", detail: "For larger companions", price: 540 },
  ],
  woods: woods.map((wood) => wood.name),
};

