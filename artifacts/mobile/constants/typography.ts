// Typography Scale - Use these 4 text styles consistently across all screens
export const TYPOGRAPHY = {
  // H1 - Page titles, main headings
  h1: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  
  // H2 - Section titles, card titles  
  h2: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  
  // Body - Main content, descriptions
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  
  // Caption - Meta text, labels, small text
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
} as const;

// Semantic text styles for specific use cases
export const TEXT_STYLES = {
  // Headers
  pageTitle: { ...TYPOGRAPHY.h1, fontSize: 24, fontWeight: '700' as const },
  sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 18, fontWeight: '700' as const },
  cardTitle: { ...TYPOGRAPHY.h2, fontSize: 14, fontWeight: '700' as const },
  
  // Content
  description: TYPOGRAPHY.body,
  instructor: { ...TYPOGRAPHY.body, fontSize: 13 },
  
  // Meta
  label: { ...TYPOGRAPHY.caption, fontWeight: '600' as const },
  meta: TYPOGRAPHY.caption,
  time: { ...TYPOGRAPHY.caption, fontSize: 11, fontWeight: '600' as const },
  
  // Interactive
  button: { ...TYPOGRAPHY.h2, fontWeight: '700' as const },
  link: { ...TYPOGRAPHY.body, fontWeight: '600' as const },
} as const;