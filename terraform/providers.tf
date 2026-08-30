provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

provider "cloudflare" {
  # Uses CLOUDFLARE_API_TOKEN from the environment.
}

