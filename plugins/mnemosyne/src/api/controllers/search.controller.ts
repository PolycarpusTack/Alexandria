import { Request, Response } from 'express';
import { SearchService } from '../../services/SearchService';
import { ApiError } from '../../utils/errors';

export class SearchController {
  private searchService: SearchService;

  constructor() {
    this.searchService = new SearchService();
  }

  search = async (req: Request, res: Response, next: Function) => {
    try {
      const { query, tags, type, limit = 20, offset = 0 } = req.body;

      if (!query || query.trim().length === 0) {
        throw new ApiError('Search query is required', 400);
      }

      const results = await this.searchService.search({
        query: query.trim(),
        tags,
        type,
        limit: Math.min(limit, 100),
        offset: Math.max(offset, 0)
      });

      res.json(results);
    } catch (error) {
      next(error);
    }
  };

  getSuggestions = async (req: Request, res: Response, next: Function) => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.json([]);
      }

      const suggestions = await this.searchService.getSuggestions(query);
      res.json(suggestions);
    } catch (error) {
      next(error);
    }
  };
}