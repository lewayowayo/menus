// Partage entre les téléphones de la famille (Supabase). Laisser vide = mode local (données sur ce téléphone uniquement).
// La clé « anon » est publique par nature. Accès sans mot de passe : quiconque a l'adresse de l'appli peut lire et modifier le menu.
window.MENUS_CONFIG = {
  supabaseUrl: 'https://wmwvypzmhleddcdusbhv.supabase.co',
  supabaseKey: 'sb_publishable_-9k14q7v2Y0dhXY2CdRquw_0b72oYyC',
  // Accès libre (choix d'Etienne, 22/11/2026) : pas de mot de passe à taper, ce jeton public suffit.
  acces: 'menus-famille-acces-libre'
};
