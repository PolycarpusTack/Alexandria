"""
Setup file for EnterpriseChunker package
"""

import os
from setuptools import setup, find_packages

# Read the README.md for the long description
readme_path = os.path.join(os.path.dirname(__file__), "README.md")
try:
    with open(readme_path, "r", encoding="utf-8") as fh:
        long_description = fh.read()
except (IOError, FileNotFoundError):
    long_description = "Advanced text chunking utility for LLM processing"

# Define package dependencies
INSTALL_REQUIRES = [
    # Core dependencies required for basic functionality
    "psutil>=5.9.0",
    "numpy>=1.22.0",
    "prometheus_client>=0.14.0",
    "requests>=2.27.0",
]

# Optional dependencies for extended functionality
EXTRAS_REQUIRE = {
    "dev": [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
        "black>=23.0.0",
        "isort>=5.0.0",
        "mypy>=1.0.0",
        "pylint>=2.17.0",
    ],
    "docs": [
        "sphinx>=6.0.0",
        "sphinx-rtd-theme>=1.0.0",
        "myst-parser>=2.0.0",
    ],
    "testing": [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
    ],
    # Convenience meta-package for development
    "all": [],  # Will be filled below
}

# Add all other extras to 'all'
EXTRAS_REQUIRE["all"] = sorted({
    dependency
    for extra_dependencies in EXTRAS_REQUIRE.values()
    for dependency in extra_dependencies
})

setup(
    name="enterprise-chunker",
    version="1.0.0-rc1",  # Bumped version to Release Candidate 1
    author="Your Organization",
    author_email="info@example.com",
    description="Advanced text chunking utility for LLM processing",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/enterprise-chunker",
    project_urls={
        "Bug Tracker": "https://github.com/your-org/enterprise-chunker/issues",
        "Documentation": "https://enterprise-chunker.readthedocs.io/",
        "Source Code": "https://github.com/your-org/enterprise-chunker",
    },
    packages=find_packages(include=["enterprise_chunker", "enterprise_chunker.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Text Processing",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=INSTALL_REQUIRES,
    extras_require=EXTRAS_REQUIRE,
    test_suite="tests",
    include_package_data=True,
    zip_safe=False,
    keywords="llm, chunking, text-processing, language-model",
)