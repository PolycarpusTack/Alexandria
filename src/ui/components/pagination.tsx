import React from 'react';

export interface PaginationProps {
  /**
   * Total number of items
   */
  total: number;

  /**
   * Current page (1-indexed)
   */
  page: number;

  /**
   * Number of items per page
   */
  pageSize: number;

  /**
   * Called when page changes
   */
  onChange: (page: number) => void;

  /**
   * Called when page size changes
   */
  onPageSizeChange?: (pageSize: number) => void;

  /**
   * Available page size options
   */
  pageSizeOptions?: number[];

  /**
   * Whether to show the page size changer
   */
  showSizeChanger?: boolean;

  /**
   * Whether to show quick jump to page
   */
  showQuickJumper?: boolean;

  /**
   * Number of pages to show in pagination
   * (not counting prev/next/first/last buttons)
   */
  siblingCount?: number;

  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Pagination component for navigating through pages of data.
 */
export const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize,
  onChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showSizeChanger = false,
  showQuickJumper = false,
  siblingCount = 1,
  className = ''
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Calculate page range to display
  const getPageRange = () => {
    const range: number[] = [];

    // Always include first page
    range.push(1);

    // Calculate start and end of current window
    const startPage = Math.max(2, page - siblingCount);
    const endPage = Math.min(totalPages - 1, page + siblingCount);

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      range.push(-1); // -1 represents ellipsis
    }

    // Add pages around current page
    for (let i = startPage; i <= endPage; i++) {
      range.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      range.push(-2); // -2 represents ellipsis (different key from the first one)
    }

    // Always include last page if it's not the first page
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  const pageRange = getPageRange();

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) {
      return;
    }
    onChange(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(event.target.value);
    onPageSizeChange?.(newPageSize);
  };

  // Handle quick jump
  const handleQuickJump = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const target = event.target as HTMLInputElement;
      const value = parseInt(target.value, 10);
      if (!isNaN(value)) {
        handlePageChange(value);
        target.value = '';
      }
    }
  };

  return (
    <div className={`alexandria-pagination ${className}`}>
      {/* Page size changer */}
      {showSizeChanger && (
        <div className='alexandria-pagination-size-changer'>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className='alexandria-pagination-size-select'
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pagination controls */}
      <div className='alexandria-pagination-controls'>
        {/* Previous page button */}
        <button
          className='alexandria-pagination-prev'
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          aria-label='Previous page'
        >
          Previous
        </button>

        {/* Page numbers */}
        <div className='alexandria-pagination-pages'>
          {pageRange.map((pageNum, index) => {
            // Render ellipsis
            if (pageNum < 0) {
              return (
                <span key={`ellipsis-${pageNum}`} className='alexandria-pagination-ellipsis'>
                  ...
                </span>
              );
            }

            // Render regular page button
            return (
              <button
                key={`page-${pageNum}`}
                className={`alexandria-pagination-page ${page === pageNum ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
                aria-current={page === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next page button */}
        <button
          className='alexandria-pagination-next'
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages}
          aria-label='Next page'
        >
          Next
        </button>
      </div>

      {/* Quick jumper */}
      {showQuickJumper && (
        <div className='alexandria-pagination-quick-jumper'>
          Go to
          <input
            type='number'
            min={1}
            max={totalPages}
            onKeyDown={handleQuickJump}
            className='alexandria-pagination-jumper-input'
            aria-label='Jump to page'
          />
        </div>
      )}

      {/* Total info */}
      <div className='alexandria-pagination-total'>{total} items</div>
    </div>
  );
};
