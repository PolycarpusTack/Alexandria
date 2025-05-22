"""
Content feature models for text analysis
"""

from dataclasses import dataclass


@dataclass
class ContentFeatures:
    """Features extracted from text for analysis"""
    length: int
    word_count: int
    whitespace_ratio: float
    symbol_density: float
    has_cjk: bool
    has_emoji: bool
    avg_word_length: float
    sentences_count: int = 0
    has_code_blocks: bool = False
    has_list_items: bool = False
    has_tables: bool = False
    has_headings: bool = False
