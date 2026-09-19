export function buildPagination(query, defaultLimit = 12) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse({ items, total, page, limit }) {
  return {
    success: true,
    count: items.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: items,
  };
}
